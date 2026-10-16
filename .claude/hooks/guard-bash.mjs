#!/usr/bin/env node
// PreToolUse(Bash) フック：ループが危険・ズルな操作をしないようにブロックする。
// exit 2 で実行を止め、stderr の内容が Claude に返される。
import { readFileSync } from "node:fs";
import { blockReason } from "./bash-rules.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const reason = blockReason(input.tool_input?.command ?? "");
if (reason) {
  console.error(`ブロックしました: ${reason}`);
  process.exit(2);
}
