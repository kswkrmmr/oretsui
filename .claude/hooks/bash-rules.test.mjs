import { describe, expect, it } from "vitest";
import { blockReason } from "./bash-rules.mjs";

describe("ブロックするコマンド", () => {
  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin main && echo done",
    "git push --force origin issue-4-map",
    "git push -f origin issue-4-map",
    "git commit --no-verify -m x",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "rm -rf /",
    "rm -rf ~",
    "rm -rf .",
    "cat .env.local",
    "cat ./.env",
    "cp .env.local /tmp/x",
    "gh pr merge 3",
    "gh issue close 4",
  ])("%s", (command) => {
    expect(blockReason(command)).not.toBeNull();
  });
});

describe("許可するコマンド", () => {
  it.each([
    "git push -u origin issue-4-map",
    "git push -u origin HEAD",
    "git push -u origin issue-4-main-screen",
    "git push -u origin issue-4-map; gh pr create -B main -t x",
    "git push -u origin issue-4-map && gh pr create --base main",
    "npm run verify",
    "rm -rf node_modules",
    "rm -rf .next",
    "cat .env.example",
    'node -e "console.log(process.env.LOOP_GUARD_BASE)"',
    "LOOP_GUARD_BASE=HEAD node scripts/loop-guard/cli.mjs verify",
    "gh issue view 4 --comments",
    "gh pr create --draft",
  ])("%s", (command) => {
    expect(blockReason(command)).toBeNull();
  });
});
