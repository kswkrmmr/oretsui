# oretsui（俺についてこい）

散歩ルートを自動で決めてくれる、スマホ向け Web アプリ。
ループエンジニアリング（AI エージェントの自律ループ）で開発している。

## 技術構成

- Next.js 15（App Router）+ TypeScript + Tailwind CSS v4
- 地図: Google Maps JavaScript API（`@vis.gl/react-google-maps`）
- ルート: Google Routes API（徒歩）。API キーを使う呼び出しはサーバー側（Route Handler）から行う
- テスト: Vitest（`src/**/*.test.ts(x)`）、Playwright（`e2e/`、iPhone 15 / Pixel 7）

## コマンド

| コマンド                                | 内容                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                           | 開発サーバー                                                             |
| `npm run verify`                        | lint → 型チェック → ユニット → E2E（本番ビルド込み）。**唯一の合否判定** |
| `npm run format`                        | Prettier で整形                                                          |
| `node scripts/loop-guard/cli.mjs <cmd>` | ループの見張り役（回数・時間の判定）                                     |

## 開発ループ

`/loop /loop-iteration` で、issue を1つずつ自律的に進める。手順は `.claude/skills/loop-iteration/SKILL.md`。

### 処理順（ラベルで決める）

人間が仕様を確認して `loop:ready` ラベルを付けた issue だけに着手する。次の issue は `node scripts/loop-guard/cli.mjs next` で決める（#76）。

1. `rehearsal`（ループのリハーサル用）
2. `priority:high`（先にやってほしいもの）
3. それ以外

同じ順位の中では番号の小さい順。順番を変えたいときは `priority:high` を付け外しする（CLAUDE.md の変更や PR は要らない）。
リハーサルで止まった issue は本番のループを止めない。

### ラベル

`loop:ready` → `loop:in-progress` → `loop:review` →（人間がマージ）→ close
止まったら `loop:stopped`。人間が判断をコメントし、`node scripts/loop-guard/cli.mjs resume <番号>` → `/loop /loop-iteration` で再開する。
人間が担当する issue は `human-task`

### ルール

- **1周で扱う issue は1つだけ**。PR を作ったら、人間がマージするまで次へ進まない
- **自律範囲は issue の中だけ**。仕様に判断が必要なら、issue に質問を書いて停止する
- issue に書かれていない機能を足さない。気づいた改善点は PR の本文に「提案」として書く
- 完了条件ごとに、先にテストを書く
- 外部 API はテストでモックする。テストが実 API や API キーに依存しないこと
- 回数・時間の判定は `loop-guard` に任せる。自分で数えない

### 完了の定義

1. `loop-guard verify` が CONTINUE（= `npm run verify` 全通過）
2. `reviewer` サブエージェントが `VERDICT: PASS`
3. PR を作成し（`Closes #番号`）、CI が通過

### 終了条件（失敗で止める）

`scripts/loop-guard/core.mjs` の `LIMITS` で機械的に判定する。

|     | 条件                                                                 |
| --- | -------------------------------------------------------------------- |
| A   | 同じエラーが2回連続                                                  |
| B   | 1 issue で検証失敗が合計5回                                          |
| C   | 1 issue に30分以上                                                   |
| D   | レビュー役 FAIL が2回連続                                            |
| E   | コードで直せない失敗（API キー不足・クォータ・ネットワーク）→ 即停止 |
| F   | CI 失敗が2回                                                         |
| G   | 差分が500行超（package-lock.json を除く）                            |

### 禁止事項

- テストの削除・skip・期待値の緩和で検証を通すこと
- issue と無関係に lint / tsconfig / テスト設定 / `.claude/` / `scripts/loop-guard/` / `.github/` を変更すること
- `@ts-ignore`・`eslint-disable`・`any` でエラーを黙らせること
- `.env*`（`.env.example` 以外）を読む・書くこと。API キーをコードに書くこと
- main への直接 push、force push、PR のマージ、issue のクローズ（hooks でもブロックしている）

## コーディング規約

- コメント・テスト名・UI の文言は日本語
- ルート計算などのロジックは純粋関数として `src/lib/` に置き、API 呼び出しや UI と分ける
- スマホ前提: タップ領域 44px 以上、高さは `100dvh`、片手で届く画面下部に操作を置く
- ブランチ名は `issue-<番号>-<英語の短い説明>`（`main` という単語を含めない）
