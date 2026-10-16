// guard-bash.mjs が使うブロック規則。誤検知を防ぐため bash-rules.test.mjs でテストしている。
// 注意: フックはコマンド全文（ヒアドキュメントの中身も含む）を検査する。
// 規則に当たる文字列をファイルに書きたいときは Bash ではなく Write ツールを使うこと。

/** ファイル名としての .env / .env.local など（.env.example と process.env は対象外） */
const ENV_FILE =
  /(^|[\s/'"=<>])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'";|&)<>])/m;

export const RULES = [
  [
    /git\s+push\b[^\n;|&]*\s(HEAD:)?(main|master)(\s|$|[;|&])/m,
    "main への直接 push は禁止です。ブランチを切って PR を作ってください",
  ],
  [
    /git\s+push\b[^\n;|&]*(--force\b|\s-f\b|--force-with-lease)/,
    "force push は禁止です",
  ],
  [/--no-verify\b/, "--no-verify でのチェック回避は禁止です"],
  [
    /git\s+(reset\s+--hard|clean\s+-[a-z]*f)/,
    "作業の破棄（reset --hard / clean -f）は禁止です。必要なら人間に頼んでください",
  ],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.(\s|$)|\.\.)/m, "広範囲の削除は禁止です"],
  [ENV_FILE, ".env ファイルの読み書きは禁止です（APIキーを守るため）"],
  [/gh\s+pr\s+merge\b/, "PR のマージは人間が行います"],
  [
    /gh\s+issue\s+(close|delete)\b/,
    "issue のクローズ・削除は人間（または PR のマージ）が行います",
  ],
];

/** ブロックすべきならその理由を、問題なければ null を返す */
export function blockReason(command) {
  const hit = RULES.find(([pattern]) => pattern.test(command));
  return hit ? hit[1] : null;
}
