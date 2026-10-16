import { describe, expect, it } from "vitest";
import {
  LIMITS,
  applyCi,
  applyReview,
  applyVerify,
  errorSignature,
  evaluate,
  initialState,
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
