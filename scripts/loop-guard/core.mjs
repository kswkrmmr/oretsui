// ループの終了条件を判定する純粋関数群。
// 回数や時間は AI に数えさせず、このモジュールで機械的に判定する。

/** 終了条件（issue #2 で「厳しめ」に決定） */
export const LIMITS = {
  sameErrorStreak: 2, // A. 同じエラーが連続
  verifyFailures: 5, // B. 1 issue での検証失敗の合計
  elapsedMinutes: 30, // C. 1 issue の作業時間
  reviewFailStreak: 2, // D. レビュー役 FAIL の連続
  ciFailures: 2, // F. ローカル通過・CI 失敗
  diffLines: 500, // G. 差分の行数
};

/** コードでは直せない失敗（E）。見つけたら即停止する */
const EXTERNAL_FAILURE_PATTERNS = [
  /NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.*(missing|未設定|undefined)/i,
  /OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|REQUEST_DENIED/,
  /\b(ENOTFOUND|EAI_AGAIN)\b/,
  /ENOSPC/,
];

export function initialState(issue, now) {
  return {
    issue,
    startedAt: now,
    verifyFailures: 0,
    lastErrorSignature: null,
    sameErrorStreak: 0,
    reviewFailStreak: 0,
    ciFailures: 0,
    stopped: false,
    stopReason: null,
    history: [],
  };
}

/** ANSI 色・数字・時間など毎回変わる部分を消して、失敗内容の「指紋」を作る */
export function errorSignature(output) {
  const lines = output
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .filter((line) =>
      /(error|fail|✘|×|expected|received|timed? ?out)/i.test(line),
    )
    .map((line) =>
      line
        .replace(/\(\d+(\.\d+)?m?s\)/g, "")
        .replace(/\d+/g, "N")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const unique = [...new Set(lines)].sort().slice(0, 30);
  return unique.length > 0 ? hash(unique.join("\n")) : "unknown";
}

function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export function detectExternalFailure(output) {
  const hit = EXTERNAL_FAILURE_PATTERNS.find((re) => re.test(output));
  return hit ? `コードで直せない失敗を検知しました（${hit.source}）` : null;
}

export function applyVerify(state, { passed, output }) {
  const next = { ...state, history: [...state.history] };
  if (passed) {
    next.lastErrorSignature = null;
    next.sameErrorStreak = 0;
    next.history.push({ type: "verify", result: "pass" });
    return next;
  }
  const signature = errorSignature(output);
  next.verifyFailures += 1;
  next.sameErrorStreak =
    signature === state.lastErrorSignature ? state.sameErrorStreak + 1 : 1;
  next.lastErrorSignature = signature;
  next.history.push({ type: "verify", result: "fail", signature });
  const external = detectExternalFailure(output);
  if (external) return stop(next, `E. ${external}`);
  return next;
}

export function applyReview(state, passed) {
  return {
    ...state,
    reviewFailStreak: passed ? 0 : state.reviewFailStreak + 1,
    history: [
      ...state.history,
      { type: "review", result: passed ? "pass" : "fail" },
    ],
  };
}

export function applyCi(state, passed) {
  return {
    ...state,
    ciFailures: passed ? state.ciFailures : state.ciFailures + 1,
    history: [
      ...state.history,
      { type: "ci", result: passed ? "pass" : "fail" },
    ],
  };
}

export function stop(state, reason) {
  return { ...state, stopped: true, stopReason: reason };
}

/** 終了条件に当たっていれば停止理由を返す。続けてよければ null */
export function evaluate(state, { now, diffLines }) {
  if (state.stopped) return state.stopReason;
  const minutes = (now - state.startedAt) / 60000;
  if (state.sameErrorStreak >= LIMITS.sameErrorStreak)
    return `A. 同じエラーが${state.sameErrorStreak}回続きました`;
  if (state.verifyFailures >= LIMITS.verifyFailures)
    return `B. 検証の失敗が合計${state.verifyFailures}回に達しました`;
  if (minutes >= LIMITS.elapsedMinutes)
    return `C. 作業時間が${Math.floor(minutes)}分を超えました`;
  if (state.reviewFailStreak >= LIMITS.reviewFailStreak)
    return `D. レビュー役の FAIL が${state.reviewFailStreak}回続きました`;
  if (state.ciFailures >= LIMITS.ciFailures)
    return `F. CI の失敗が${state.ciFailures}回に達しました`;
  if (diffLines > LIMITS.diffLines)
    return `G. 差分が${diffLines}行あります（上限${LIMITS.diffLines}行）`;
  return null;
}
/** ループ自身が PR に書くコメントに付ける目印。見張りの対象から外すために使う */
export const LOOP_COMMENT_MARKER = "<!-- loop -->";

/** watch-pr が PR 情報の取得に何回続けて失敗したら諦めるか */
export const WATCH_MAX_ERRORS = 3;

/** リポジトリへの書き込み権限がある人だけを「人間のレビュアー」とみなす（Public リポジトリなので部外者は除く） */
const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/**
 * gh の出力ではボットの login に "[bot]" が付かない（例: "github-actions"）ため、名前でも判定する。
 * authorAssociation もボットが CONTRIBUTOR になることがあり、それだけでは区別できない。
 */
const BOT_LOGINS =
  /^(github-actions|dependabot|renovate|vercel|netlify|codecov|copilot.*)$|\[bot\]$/i;

/**
 * PR の見張り：ループが反応すべき出来事を返す。何も起きていなければ null。
 * 「最後の push より後」の人間のコメント・レビューだけを数えるので、
 * 見張りを始める前に付いたコメントも拾える（CI 待ちの間の変更依頼など）。
 *
 * pr = {
 *   state: "OPEN" | "MERGED" | "CLOSED",
 *   lastPushedAt: ISO文字列,
 *   comments: [{ createdAt, author: { login }, authorAssociation, body }],
 *   reviews: [{ submittedAt, author: { login }, authorAssociation, body }],
 * }
 */
export function prEvent(pr, { since: handledAt } = {}) {
  if (pr.state === "MERGED") return "MERGED";
  if (pr.state === "CLOSED") return "CLOSED";
  // 最後の push か、ループが最後に対応した時刻（--since）の遅い方より後だけを見る
  const since = Math.max(
    Date.parse(pr.lastPushedAt),
    Date.parse(handledAt ?? 0) || 0,
  );
  const fromHuman = (item) =>
    TRUSTED_ASSOCIATIONS.has(item.authorAssociation) &&
    !BOT_LOGINS.test(item.author?.login ?? "") &&
    !(item.body ?? "").includes(LOOP_COMMENT_MARKER);
  const newComments = pr.comments.filter(
    (c) => Date.parse(c.createdAt) > since && fromHuman(c),
  );
  const newReviews = pr.reviews.filter(
    (r) => Date.parse(r.submittedAt) > since && fromHuman(r),
  );
  return newComments.length + newReviews.length > 0 ? "COMMENTED" : null;
}
