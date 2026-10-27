import { describe, expect, it } from "vitest";
import { parseWeight, WALK_METS, walkingCalories } from "./calories";

describe("parseWeight", () => {
  it.each([
    ["60", 60],
    ["20", 20],
    ["200", 200],
    [" 65 ", 65],
  ])("「%s」は %i kg として扱う", (input, weight) => {
    expect(parseWeight(input)).toBe(weight);
  });

  it.each(["", "0", "19", "201", "300", "-60", "60.5", "abc", "６０"])(
    "「%s」は未入力として扱う",
    (input) => {
      expect(parseWeight(input)).toBeNull();
    },
  );
});

describe("walkingCalories", () => {
  it("歩く速さの METs は、ゆっくり 3.0・ふつう 3.5・早歩き 4.3", () => {
    expect(WALK_METS).toEqual({ slow: 3.0, normal: 3.5, fast: 4.3 });
  });

  it("METs × 体重 × 時間 × 1.05 で計算し、整数に四捨五入する", () => {
    // ふつう（80 m/分）で 2400 m → 30分 = 0.5 時間。3.5 × 60 × 0.5 × 1.05 = 110.25
    expect(walkingCalories(60, 2400, "normal")).toBe(110);
  });

  it("時間は歩いた距離 ÷ 歩く速さで出す", () => {
    // ゆっくり（60 m/分）で 1800 m → 30分。3.0 × 70 × 0.5 × 1.05 = 110.25
    expect(walkingCalories(70, 1800, "slow")).toBe(110);
    // 早歩き（100 m/分）で 3000 m → 30分。4.3 × 50 × 0.5 × 1.05 = 112.875
    expect(walkingCalories(50, 3000, "fast")).toBe(113);
  });

  it("体重が未入力なら返さない", () => {
    expect(walkingCalories(null, 2400, "normal")).toBeNull();
  });

  it("まだ歩いていなければ 0", () => {
    expect(walkingCalories(60, 0, "normal")).toBe(0);
  });
});
