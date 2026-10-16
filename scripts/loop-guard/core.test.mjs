import { describe, expect, it } from "vitest";
import {
  LIMITS,
  LOOP_COMMENT_MARKER,
  applyCi,
  applyReview,
  applyVerify,
  errorSignature,
  evaluate,
  initialState,
  prEvent,
} from "./core.mjs";

const T0 = Date.UTC(2026, 9, 16, 0, 0, 0);
const ok = { now: T0, diffLines: 0 };
const fail = (output) => ({ passed: false, output });

describe("errorSignature", () => {
  it("所要時間や行番号が違っても同じ失敗なら同じ指紋になる", () => {
    const a = "✘ map.spec.ts:12:3 地図が出る (1.2s)\nError: expected 1";
    const b = "✘ map.spec.ts:15:3 地図が出る (3.4s)\nError: expected 1";
    expect(errorSignature(a)).toBe(errorSignature(b));
  });

  it("中身が違う失敗は別の指紋になる", () => {
    expect(errorSignature("Error: foo is not defined")).not.toBe(
      errorSignature("Error: bar is not defined"),
    );
  });
});

describe("evaluate", () => {
  it("初期状態では続行する", () => {
    expect(evaluate(initialState(4, T0), ok)).toBeNull();
  });

  it("A. 同じエラーが連続したら止まる", () => {
    let s = initialState(4, T0);
    for (let i = 0; i < LIMITS.sameErrorStreak; i++) {
      s = applyVerify(s, fail("Error: same"));
    }
    expect(evaluate(s, ok)).toMatch(/^A\./);
  });

  it("間に成功を挟めば同じエラーの連続はリセットされる", () => {
    let s = initialState(4, T0);
    s = applyVerify(s, fail("Error: same"));
    s = applyVerify(s, { passed: true, output: "" });
    s = applyVerify(s, fail("Error: same"));
    expect(evaluate(s, ok)).toBeNull();
  });

  it("B. 違うエラーでも合計回数に達したら止まる", () => {
    let s = initialState(4, T0);
    for (let i = 0; i < LIMITS.verifyFailures; i++) {
      s = applyVerify(s, fail(`Error: case ${"x".repeat(i)}`));
    }
    expect(evaluate(s, ok)).toMatch(/^B\./);
  });

  it("C. 制限時間を超えたら止まる", () => {
    const now = T0 + LIMITS.elapsedMinutes * 60000;
    expect(evaluate(initialState(4, T0), { now, diffLines: 0 })).toMatch(
      /^C\./,
    );
  });

  it("D. レビュー FAIL が連続したら止まり、PASS でリセットされる", () => {
    let s = initialState(4, T0);
    s = applyReview(s, false);
    s = applyReview(s, true);
    s = applyReview(s, false);
    expect(evaluate(s, ok)).toBeNull();
    s = applyReview(s, false);
    expect(evaluate(s, ok)).toMatch(/^D\./);
  });

  it("E. コードで直せない失敗は1回で止まる", () => {
    const s = applyVerify(
      initialState(4, T0),
      fail("Routes API error: OVER_QUERY_LIMIT"),
    );
    expect(evaluate(s, ok)).toMatch(/^E\./);
  });

  it("F. CI の失敗が上限に達したら止まる", () => {
    let s = initialState(4, T0);
    for (let i = 0; i < LIMITS.ciFailures; i++) s = applyCi(s, false);
    expect(evaluate(s, ok)).toMatch(/^F\./);
  });

  it("G. 差分が上限を超えたら止まる", () => {
    expect(
      evaluate(initialState(4, T0), {
        now: T0,
        diffLines: LIMITS.diffLines + 1,
      }),
    ).toMatch(/^G\./);
  });
});

describe("prEvent", () => {
  const PUSHED = "2026-10-16T10:00:00Z";
  const BEFORE = "2026-10-16T09:59:00Z";
  const AFTER = "2026-10-16T10:01:00Z";
  const human = { login: "kswkrmmr" };
  const open = {
    state: "OPEN",
    lastPushedAt: PUSHED,
    comments: [],
    reviews: [],
  };
  const comment = (createdAt, extra = {}) => ({
    createdAt,
    author: human,
    authorAssociation: "OWNER",
    body: "ここを直してください",
    ...extra,
  });

  it("変化がなければ null", () => {
    expect(prEvent(open)).toBeNull();
  });

  it("マージされたら MERGED", () => {
    expect(prEvent({ ...open, state: "MERGED" })).toBe("MERGED");
  });

  it("マージせずに閉じられたら CLOSED", () => {
    expect(prEvent({ ...open, state: "CLOSED" })).toBe("CLOSED");
  });

  it("最後の push より後の人間のコメントは COMMENTED", () => {
    expect(prEvent({ ...open, comments: [comment(AFTER)] })).toBe("COMMENTED");
  });

  it("最後の push より後のレビューは COMMENTED", () => {
    const review = {
      submittedAt: AFTER,
      author: human,
      authorAssociation: "OWNER",
      body: "",
    };
    expect(prEvent({ ...open, reviews: [review] })).toBe("COMMENTED");
  });

  it("最後の push より前のコメントは対応済みとみなす", () => {
    expect(prEvent({ ...open, comments: [comment(BEFORE)] })).toBeNull();
  });

  it("ボットのコメントは無視する（gh の実際の出力の形）", () => {
    const bots = [
      // gh では "[bot]" が付かず、authorAssociation も CONTRIBUTOR になる
      comment(AFTER, {
        author: { login: "github-actions" },
        authorAssociation: "CONTRIBUTOR",
      }),
      comment(AFTER, { author: { login: "vercel" } }),
      comment(AFTER, { author: { login: "renovate[bot]" } }),
    ];
    expect(prEvent({ ...open, comments: bots })).toBeNull();
  });

  it("書き込み権限のない人のコメントは無視する（Public リポジトリの部外者）", () => {
    const outsiders = [
      comment(AFTER, { authorAssociation: "NONE" }),
      comment(AFTER, { authorAssociation: "CONTRIBUTOR" }),
    ];
    expect(prEvent({ ...open, comments: outsiders })).toBeNull();
  });

  it("共同作業者のコメントは拾う", () => {
    const c = comment(AFTER, { authorAssociation: "COLLABORATOR" });
    expect(prEvent({ ...open, comments: [c] })).toBe("COMMENTED");
  });

  it("ループ自身のコメント（目印付き）は無視する", () => {
    const own = comment(AFTER, { body: `${LOOP_COMMENT_MARKER}\n回答です` });
    expect(prEvent({ ...open, comments: [own] })).toBeNull();
  });

  it("コメントとマージが同時ならマージを優先する", () => {
    expect(
      prEvent({ ...open, state: "MERGED", comments: [comment(AFTER)] }),
    ).toBe("MERGED");
  });
});

describe("prEvent の --since（ループが対応した時刻）", () => {
  const base = {
    state: "OPEN",
    lastPushedAt: "2026-10-16T10:00:00Z",
    reviews: [],
    comments: [
      {
        createdAt: "2026-10-16T10:05:00Z",
        author: { login: "kswkrmmr" },
        authorAssociation: "OWNER",
        body: "これは何のための変更？",
      },
    ],
  };

  it("対応済みの質問には、再起動後に反応しない", () => {
    expect(prEvent(base, { since: "2026-10-16T10:06:00Z" })).toBeNull();
  });

  it("対応した後に付いた新しいコメントには反応する", () => {
    expect(prEvent(base, { since: "2026-10-16T10:04:00Z" })).toBe("COMMENTED");
  });

  it("since が push より前なら push の時刻を基準にする", () => {
    const old = {
      ...base,
      comments: [{ ...base.comments[0], createdAt: "2026-10-16T09:00:00Z" }],
    };
    expect(prEvent(old, { since: "2026-10-16T08:00:00Z" })).toBeNull();
  });
});
