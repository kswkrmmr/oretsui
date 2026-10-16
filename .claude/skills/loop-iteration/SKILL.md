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
2. `needs-human` ラベルが付いていて open の issue がある（`gh issue list -l needs-human --state open`）
   → それが処理順の途中にある issue なら、人間待ち。ループを終了する
3. `$G status` に作業中の issue がある → その issue の **手順 3** から再開する
4. `loop:review` ラベルの issue がある → **手順 7（マージ待ち）** へ
5. どれでもない → **手順 1** へ

## 1. 次の issue を選ぶ

- `rehearsal` と `loop:ready` の両方が付いた open の issue があれば、それを最優先で選ぶ（ループのリハーサル用）
- なければ `CLAUDE.md` の「処理順」の中で、open かつ `loop:ready` ラベルが付いた最初の issue を選ぶ
- 見つからなければ PushNotification で「着手できる issue がありません」と通知し、ループを終了する

## 2. 準備

```bash
git switch main && git pull
git switch -c issue-<番号>-<英語の短い説明>
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

`loop:review` の issue に紐づく PR の状態を `gh pr view <PR> --json state,mergedAt` で確認する。

- マージ済み → `gh issue edit <番号> --remove-label loop:review` をして **手順 1** へ（このターンで続けてよい）
- 未マージ → 何もせず ScheduleWakeup で 1200 秒後に再確認する
- PR に変更依頼のコメントがある → 内容を issue の範囲内で反映し、手順 4 から（`$G start <番号>` で再開）

## 停止手順

1. 作業中の変更をコミットし、`git push -u origin HEAD`
2. `gh pr create --draft` で下書き PR を作る（PR がまだなければ）
3. issue にコメント：停止理由（loop-guard の STOP 文言）、試したこと、エラーの要点、原因の推測、人間に判断してほしいこと
4. `gh issue edit <番号> --remove-label loop:in-progress --add-label needs-human`
5. PushNotification で「#<番号> で停止しました：<理由>」と通知
6. ScheduleWakeup を `stop: true` で呼び、ループを終了する
