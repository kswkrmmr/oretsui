#!/usr/bin/env node
// PostToolUse(Edit|Write) フック：編集したファイルを Prettier で整形する。
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path;
if (file && /\.(m?[jt]sx?|json|css|md|ya?ml)$/.test(file)) {
  spawnSync("npx", ["prettier", "--write", "--ignore-unknown", file], {
    stdio: "ignore",
  });
}
