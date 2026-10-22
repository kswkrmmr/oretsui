---
name: loop-iteration
description: oretsui の開発ループを1周進める。人間が `/loop /loop-iteration` で起動したとき（およびそのループの再開時）だけ使う。それ以外の場面で自分から使ってはいけない。issue を1つ取り、実装・検証・レビュー・PR作成まで行い、人間のマージを待つ。
---

<!-- disable-model-invocation を付けると /loop から呼び出せなくなるため付けない（リハーサル #17 で判明） -->

# 開発ループ 1周分の手順

`CLAUDE.md` のルールに従うこと。回数・時間の判定は必ず `loop-guard` に任せ、自分で数えない。

```
G = node scripts/loop-guard/cli.mjs
```

## 0. 現在の状態を確認する

上から順に確認し、最初に当てはまったものを実行する。

1. `$G status` が `"stopped": true` → **停止済み**。ループを終了する（ScheduleWakeup を `stop: true` で呼ぶ）
2. `loop:stopped` ラベルが付いた open の issue がある（`gh issue list -l loop:stopped --state open --search "-label:rehearsal"`）
   → 人間の対応待ち。ループを終了する
   （`rehearsal` ラベルの issue はコマンドで除いている。リハーサルで止まった issue が本番のループを止めないようにするため。#22 で判明）
   （`human-task` ラベルの issue は人間が担当する作業なので、ループの判断には関係しない）
3. `$G status` に作業中の issue がある → その issue の **手順 3** から再開する
4. `loop:review` ラベルの issue がある → **手順 7（マージ待ち）** へ
5. どれでもない → **手順 1** へ

## 1. 次の issue を選ぶ

自分で選ばず、必ず `$G next` を使う（#76。処理順はラベルで決まる）。

```bash
$G next   # 次に着手する issue の番号を1行出す。なければ何も出さず終了コード 1
```

- 選ばれる順：`rehearsal` → `priority:high` → それ以外。同じ順位の中では番号の小さい順。どれも `loop:ready` が付いているものだけ
- 終了コード 1（着手できる issue がない）→ PushNotification で「着手できる issue がありません」と通知し、ループを終了する
- 終了コード 3（`ERROR:` が出る。gh の失敗＝ネットワーク・認証切れなど）→ 終了条件 E。PushNotification で「issue の一覧を取得できません：<理由>」と通知し、ループを終了する（作業中の issue はないので停止手順は不要）

## 2. 準備

まず、この issue の作業ブランチがすでにあるか確かめる（停止からの再開では、前回のブランチと下書き PR が残っている。#4 で判明）。

```bash
git switch main && git pull
git ls-remote --heads origin "issue-<番号>-*"   # リモート
git branch --list "issue-<番号>-*"               # ローカル（変更なしで止まった場合は push されていない）
```

- **ブランチがない** → 新しく切る
  ```bash
  git switch -c issue-<番号>-<英語の短い説明>
  ```
- **ブランチがある**（再開）→ それに切り替えて main を取り込む。下書き PR があればそのまま使う
  ```bash
  git switch <ブランチ名>
  git pull   # リモートにある場合のみ
  git merge main
  ```
  手順3では、issue の最新コメント（人間の判断）を必ず読んでから続きを行う

```bash
gh issue edit <番号> --remove-label loop:ready --add-label loop:in-progress
$G start <番号>
```

## 3. 実装（作る役）

1. `gh issue view <番号> --comments` で目的・完了条件・過去のコメントを読む
2. **仕様に判断が必要な点があれば実装しない**。issue に質問をコメントし、`$G stop "仕様の確認が必要"` を実行して **停止手順** へ
3. 完了条件ごとに、**先にテストを書く**（ユニット: `src/**/*.test.ts(x)`、E2E: `e2e/*.spec.ts`）
4. テストが通るように実装する
5. 外部 API（Google Maps / Routes）はテストでモックする

## 4. 検証

```bash
$G verify
```

- 終了コード 0（CONTINUE）→ 手順 5 へ
- 終了コード 1（FAIL）→ `.loop/last-verify.log` を読んで原因を直し、もう一度 `$G verify`
- 終了コード 3（STOP）→ **停止手順** へ

## 5. レビュー（確かめる役）

Agent ツールで `reviewer` サブエージェントを呼ぶ（プロンプト: 「issue #<番号> の変更をレビューしてください」）。

- 最後の行が `VERDICT: PASS` → `$G review pass` を実行して手順 6 へ
- `VERDICT: FAIL` → `$G review fail` を実行。STOP が出たら **停止手順**、出なければ指摘を直して手順 4 へ

## 6. PR 作成と CI

```bash
git add -A && git commit -m "<内容> (#<番号>)"   # 末尾に Co-Authored-By 行を付ける
git push -u origin HEAD
gh pr create --title "<issueタイトル>" --body "<下記テンプレート>"
gh issue edit <番号> --remove-label loop:in-progress --add-label loop:review
gh pr checks --watch
```

- CI 失敗 → `$G ci fail`。STOP なら **停止手順**、そうでなければ直して手順 4 へ
- CI 成功 → `$G ci pass` の後 `$G finish`
- issue に作業ログ（何をしたか、検証・レビュー・CI の回数）をコメント
- PushNotification で「#<番号> の PR ができました。確認とマージをお願いします」と通知

PR 本文のテンプレート:

```
Closes #<番号>

## 変更内容
- ...

## 完了条件とテスト
- [x] <完了条件> … <テストファイル>

## 確認してほしいこと（スマホでの見方）
- ...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 7. マージ待ち

`loop:review` の issue に紐づく PR を見張る。見張りは自分でスクリプトを書かず、必ず `watch-pr` を使う
（リハーサル #17 で、その場で書いたスクリプトが誤報を出したため）。

`watch-pr` は「最後のコミットより後」に付いた、書き込み権限のある人のコメント・レビューを拾う。
見張りを始める前（CI 待ちの間など）に付いたコメントも拾えるので、開始のタイミングは気にしなくてよい。
ボット、書き込み権限のない人（Public リポジトリの部外者）、目印 `<!-- loop -->` を含むコメントは無視される。

1. `pgrep -f "cli.mjs watch-pr <PR番号>( |$)"` で見張りが動いていないか確かめる（`( |$)` がないと PR 2 を探して 21 に当たる）
2. 動いていなければ `$G watch-pr <PR番号>` を Bash の `run_in_background: true` で起動する
3. 保険として ScheduleWakeup を 1800 秒で設定し、ターンを終える
4. 見張りの完了通知が来たら、出力の1行を見て分岐する

| 出力        | 対応                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MERGED`    | `gh issue edit <番号> --remove-label loop:review` をして **手順 1** へ（このターンで続けてよい）                                           |
| `COMMENTED` | `gh pr view <PR番号> --comments` で読み、下の「PR のコメントへの対応」に従う                                                               |
| `CLOSED`    | マージされずに閉じられた。issue にコメントし、`--remove-label loop:review --add-label loop:stopped` でラベルを付け替えて、ループを終了する |
| `ERROR`     | PR の情報を取得できない（PR 番号の誤り・認証切れ・ネットワーク）。終了条件 E として **停止手順** へ                                        |
| `TIMEOUT`   | 見張りを再起動する                                                                                                                         |

### PR のコメントへの対応

ループが PR や issue に書くコメントには、**必ず1行目に `<!-- loop -->` を入れる**（自分のコメントに反応しないため）。

- **変更依頼** → issue の範囲内で反映する。`$G start <番号>` で再開して手順 4 から。push すれば、そのコメントは対応済みとみなされる
  - 注意：基準は push ではなく「最後のコミットの時刻」。修正中に人間が追加でコメントすると、その後のコミットで対応済み扱いになる。**push の直前に `gh pr view <PR番号> --comments` をもう一度読み、新しいコメントがないか確かめる**
- **質問** → PR にコメントで答え、見張りを `--since` 付きで再起動する
- **それ以外**（感想や範囲外の要望など）→ 範囲外の要望なら「別 issue にしましょう」とコメントし、見張りを `--since` 付きで再起動する

push せずにコメントだけ返したときは、元のコメントがまだ「最後の push より後」に残っている。
そのため、返信した時刻を `--since` に渡して、対応済みのコメントに再び反応しないようにする。

```bash
$G watch-pr <PR番号> --since "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

## 停止手順

1. `git status --short` で**未コミットの変更**があるか確かめる
   - **ある** → コミットして `git push -u origin HEAD`
   - **ない** → コミットしない（再開後に何も変えずにまた止まった場合など）
   - そのうえで `git diff main --stat` に差分があり、PR がまだなければ `gh pr create --draft` で下書き PR を作る。main との差分もなければ（実装前に止まった）PR は作らず、issue のコメントに「変更はありません」と書く
2. issue にコメント：停止理由（loop-guard の STOP 文言）、試したこと、エラーの要点、原因の推測、人間に判断してほしいこと
3. `gh issue edit <番号> --remove-label loop:in-progress --remove-label loop:review --add-label loop:stopped`
   （PR 作成後に止まった場合〔CI の失敗、watch-pr の ERROR など〕は `loop:review` が付いている。残すと再開後に「マージ待ち」と誤判定する）
4. PushNotification で「#<番号> で停止しました：<理由>」と通知
5. **リハーサル issue（`rehearsal` ラベル）の場合だけ** `$G finish` で状態を片付ける（本番のループの再開を妨げないため）
6. ScheduleWakeup を `stop: true` で呼び、ループを終了する

### 停止後の再開（人間が行う）

1. issue に判断をコメントする
2. `node scripts/loop-guard/cli.mjs resume <番号>` を実行する（`loop:stopped` → `loop:ready`、状態の片付けをまとめて行う）
3. `/loop /loop-iteration` を実行する

ループは手順2で既存のブランチを見つけて、続きから再開する。
