#!/usr/bin/env node
// ループの見張り役。状態は .loop/state.json に保存し、コンテキストが流れても数え直さない。
//
// 使い方:
//   node scripts/loop-guard/cli.mjs start <issue番号>   作業開始（同じ issue なら続きから）
//   node scripts/loop-guard/cli.mjs verify              npm run verify を実行して記録
//   node scripts/loop-guard/cli.mjs review pass|fail    レビュー役の判定を記録
//   node scripts/loop-guard/cli.mjs ci pass|fail        CI の結果を記録
//   node scripts/loop-guard/cli.mjs check               終了条件だけ確認
//   node scripts/loop-guard/cli.mjs stop "<理由>"        自分の判断で停止（仕様不明など）
//   node scripts/loop-guard/cli.mjs watch-pr <PR番号> [--since <ISO時刻>]
//                                      PR のマージ／クローズ／コメントを待つ（1行出して終了）
//   node scripts/loop-guard/cli.mjs next                次に着手する issue の番号（なければ終了コード1）
//   node scripts/loop-guard/cli.mjs status              現在の状態を表示
//   node scripts/loop-guard/cli.mjs finish              PR 作成後に状態を片付ける
//   node scripts/loop-guard/cli.mjs resume <issue番号>  （人間用）停止した issue を再開できる状態に戻す
//
// 終了コード: 0 = 続行してよい / 1 = 検証失敗（直して再実行） / 3 = 停止（STOP）

import { execFileSync, execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  applyCi,
  applyReview,
  applyVerify,
  evaluate,
  initialState,
  nextIssue,
  prEvent,
  resumeCheck,
  WATCH_MAX_ERRORS,
  stop,
} from "./core.mjs";

const DIR = ".loop";
const STATE = `${DIR}/state.json`;
const VERIFY_LOG = `${DIR}/last-verify.log`;
const VERIFY_TIMEOUT_MS = 15 * 60 * 1000;
const EXIT = { ok: 0, fail: 1, usage: 2, stop: 3 };

const load = () =>
  existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;

const save = (state) => {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
};

/** main との差分行数（未追跡ファイルを含む。package-lock.json は除く） */
function diffLines() {
  const sh = (c) => execSync(c, { encoding: "utf8" });
  const base = process.env.LOOP_GUARD_BASE ?? "main"; // 動作確認用に比較元を変えられる
  const tracked = sh(`git diff --numstat ${base}`)
    .split("\n")
    .filter((l) => l && !l.endsWith("package-lock.json"))
    .reduce((sum, l) => {
      const [add, del] = l.split("\t");
      return sum + (Number(add) || 0) + (Number(del) || 0);
    }, 0);
  const untracked = sh("git ls-files --others --exclude-standard")
    .split("\n")
    .filter(Boolean)
    .reduce((sum, f) => sum + readFileSync(f, "utf8").split("\n").length, 0);
  return tracked + untracked;
}

function requireState() {
  const state = load();
  if (!state) {
    console.error(
      "状態がありません。先に `start <issue番号>` を実行してください",
    );
    process.exit(EXIT.usage);
  }
  return state;
}

/** 状態を保存し、終了条件に当たっていれば STOP を出して終了する */
function judge(state, { failed = false } = {}) {
  const reason = evaluate(state, { now: Date.now(), diffLines: diffLines() });
  if (reason) {
    save(stop(state, reason));
    console.log(`STOP: ${reason}`);
    console.log(
      "→ 作業を下書きPRとして push し、issue に経緯をコメントして loop:stopped を付け、ループを止めてください",
    );
    process.exit(EXIT.stop);
  }
  save(state);
  if (failed) {
    console.log(
      `FAIL: 検証失敗 ${state.verifyFailures}回目（ログ: ${VERIFY_LOG}）。直して再実行してください`,
    );
    process.exit(EXIT.fail);
  }
  console.log("CONTINUE");
  process.exit(EXIT.ok);
}

const WATCH_INTERVAL_MS = 30 * 1000;
const WATCH_MAX_MS = 24 * 60 * 60 * 1000;

function fetchPr(pr) {
  const out = execFileSync(
    "gh",
    ["pr", "view", String(pr), "--json", "state,commits,comments,reviews"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const { state, commits, comments, reviews } = JSON.parse(out);
  return {
    state,
    lastPushedAt: commits.at(-1)?.committedDate ?? new Date(0).toISOString(),
    comments,
    reviews,
  };
}

/**
 * PR がマージ／クローズされるか、最後の push より後に人間のコメントが付くまで待ち、
 * 1行出して終了する。取得に続けて失敗したら ERROR（PR 番号の誤り・認証切れなど）。
 */
async function watchPr(pr, since) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + WATCH_MAX_MS;
  let errors = 0;
  while (Date.now() < deadline) {
    try {
      const event = prEvent(fetchPr(pr), { since });
      errors = 0;
      if (event) {
        console.log(`PR #${pr}: ${event}`);
        process.exit(EXIT.ok);
      }
    } catch (e) {
      errors += 1;
      if (errors >= WATCH_MAX_ERRORS) {
        const detail = String(e.stderr || e.message)
          .trim()
          .split("\n")[0];
        console.log(`PR #${pr}: ERROR ${detail}`);
        process.exit(EXIT.stop);
      }
    }
    await sleep(WATCH_INTERVAL_MS);
  }
  console.log(`PR #${pr}: TIMEOUT`);
  process.exit(EXIT.ok);
}

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case "start": {
    const issue = Number(arg);
    if (!issue) {
      console.error("issue 番号を指定してください");
      process.exit(EXIT.usage);
    }
    const current = load();
    if (current && current.issue === issue) {
      console.log(`issue #${issue} の続きから再開します`);
      judge(current);
    }
    if (current && !current.stopped) {
      console.error(
        `issue #${current.issue} が作業中です。finish か stop をしてから始めてください`,
      );
      process.exit(EXIT.usage);
    }
    save(initialState(issue, Date.now()));
    console.log(`issue #${issue} の作業を開始しました`);
    process.exit(EXIT.ok);
  }
  case "verify": {
    const state = requireState();
    if (state.stopped) judge(state);
    const result = spawnSync("npm", ["run", "verify"], {
      encoding: "utf8",
      timeout: VERIFY_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    const timedOut = result.error?.code === "ETIMEDOUT";
    const output =
      (result.stdout ?? "") +
      (result.stderr ?? "") +
      (timedOut ? "\nError: verify timed out" : "");
    mkdirSync(DIR, { recursive: true });
    writeFileSync(VERIFY_LOG, output);
    const passed = result.status === 0 && !timedOut;
    // 失敗時は末尾だけ表示（全文はログファイル）
    if (!passed) console.log(output.split("\n").slice(-60).join("\n"));
    judge(applyVerify(state, { passed, output }), { failed: !passed });
    break;
  }
  case "review":
  case "ci": {
    if (arg !== "pass" && arg !== "fail") {
      console.error(`${cmd} pass|fail を指定してください`);
      process.exit(EXIT.usage);
    }
    const state = requireState();
    const apply = cmd === "review" ? applyReview : applyCi;
    judge(apply(state, arg === "pass"));
    break;
  }
  case "check":
    judge(requireState());
    break;
  case "stop": {
    const reason = arg || "理由の記載なし";
    save(stop(requireState(), `手動停止: ${reason}`));
    console.log(`STOP: 手動停止: ${reason}`);
    process.exit(EXIT.stop);
  }
  case "watch-pr": {
    const pr = Number(arg);
    if (!pr) {
      console.error("PR 番号を指定してください");
      process.exit(EXIT.usage);
    }
    const sinceIdx = process.argv.indexOf("--since");
    await watchPr(pr, sinceIdx > 0 ? process.argv[sinceIdx + 1] : undefined);
    break;
  }
  case "resume": {
    // 人間用：停止した issue をループで再開できる状態に戻す
    const number = Number(arg);
    if (!number) {
      console.error("issue 番号を指定してください");
      process.exit(EXIT.usage);
    }
    const gh = (...args) => {
      try {
        return execFileSync("gh", args, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        const detail = String(e.stderr || e.message)
          .trim()
          .split("\n")[0];
        console.error(`再開できません: gh の実行に失敗しました（${detail}）`);
        process.exit(EXIT.usage);
      }
    };
    const { state, labels } = JSON.parse(
      gh("issue", "view", String(number), "--json", "state,labels"),
    );
    const problem = resumeCheck({
      number,
      state,
      labels: labels.map((l) => l.name),
    });
    if (problem) {
      console.error(`再開できません: ${problem}`);
      process.exit(EXIT.usage);
    }
    // PR 作成後に止まった場合の loop:review なども残さない（残すと「マージ待ち」と誤判定される）
    gh(
      "issue",
      "edit",
      String(number),
      "--remove-label",
      "loop:stopped",
      "--remove-label",
      "loop:review",
      "--remove-label",
      "loop:in-progress",
      "--add-label",
      "loop:ready",
    );
    // 別の issue（リハーサルなど）の作業中の状態は消さない
    const current = load();
    if (!current || current.issue === number) {
      rmSync(DIR, { recursive: true, force: true });
    } else {
      console.log(
        `注意: loop-guard の状態は issue #${current.issue} のものなので残しました`,
      );
    }
    console.log(
      `issue #${number} を再開できる状態にしました（loop:stopped → loop:ready）`,
    );
    console.log(
      "→ 判断を issue にコメントしてから `/loop /loop-iteration` を実行してください",
    );
    break;
  }
  case "next": {
    // 次に着手する issue の番号を出す（#76）。なければ何も出さず終了コード 1。
    // gh が失敗したら（ネットワーク・認証切れ）、「issue がない」と区別するため理由を出して終了コード 3
    const LIMIT = 200;
    let output;
    try {
      output = execFileSync(
        "gh",
        [
          "issue",
          "list",
          "--state",
          "open",
          // --label で絞ると GitHub の検索を使うため、付けたばかりのラベルが数秒間見えない。
          // open の issue を全部取ってきて、ラベルは nextIssue で絞る
          "--limit",
          String(LIMIT),
          "--json",
          "number,labels",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) {
      const detail = String(e.stderr || e.message)
        .trim()
        .split("\n")[0];
      console.error(`ERROR: issue の一覧を取得できません（${detail}）`);
      process.exit(EXIT.stop);
    }
    const all = JSON.parse(output);
    if (all.length >= LIMIT)
      console.error(
        `注意: open の issue が ${LIMIT} 件以上あり、一部しか見ていません`,
      );
    const issues = all.map(({ number, labels }) => ({
      number,
      labels: labels.map((l) => l.name),
    }));
    const number = nextIssue(issues);
    if (number === null) process.exit(EXIT.fail);
    console.log(number);
    break;
  }
  case "status":
    console.log(JSON.stringify(load(), null, 2));
    break;
  case "finish":
    rmSync(DIR, { recursive: true, force: true });
    console.log("状態を片付けました");
    break;
  default:
    console.error(
      "使い方: loop-guard <start|verify|review|ci|check|stop|watch-pr|next|status|finish|resume>",
    );
    process.exit(EXIT.usage);
}
