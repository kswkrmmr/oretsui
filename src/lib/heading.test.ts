import { describe, expect, it } from "vitest";
import {
  ROTATE_THRESHOLD_DEGREES,
  headingFromEvent,
  shouldRotate,
  smoothHeading,
} from "./heading";

describe("headingFromEvent（#69）", () => {
  it("iPhone は webkitCompassHeading をそのまま使う", () => {
    expect(headingFromEvent({ webkitCompassHeading: 90, alpha: 10 })).toBe(90);
  });

  it("Android は deviceorientationabsolute の alpha から求める（方角 = 360 − alpha）", () => {
    expect(headingFromEvent({ alpha: 90, absolute: true })).toBe(270);
    expect(headingFromEvent({ alpha: 0, absolute: true })).toBe(0);
  });

  it("方角が分からないイベントは null", () => {
    // 絶対値でない alpha（端末の向きの基準が北ではない）は使わない
    expect(headingFromEvent({ alpha: 90, absolute: false })).toBeNull();
    expect(headingFromEvent({ alpha: null, absolute: true })).toBeNull();
    expect(
      headingFromEvent({ webkitCompassHeading: null, alpha: null }),
    ).toBeNull();
  });
});

describe("smoothHeading（#69）", () => {
  it("前回の値がなければ、届いた値をそのまま使う", () => {
    expect(smoothHeading(null, 120)).toBe(120);
  });

  it("前回の値から、届いた値へ少しずつ近づける", () => {
    const next = smoothHeading(100, 120);
    expect(next).toBeGreaterThan(100);
    expect(next).toBeLessThan(120);
  });

  it("350° → 10° のように 0° をまたいでも、近い向き（時計回り）へ回る", () => {
    const next = smoothHeading(350, 10);
    // 逆回り（350 → 180 → 10）なら 350 より小さくなる。近い向きなら 350 より大きいか 0 付近
    expect(next > 350 || next < 10).toBe(true);
  });

  it("10° → 350° は反時計回りに近づく", () => {
    const next = smoothHeading(10, 350);
    expect(next < 10 || next > 350).toBe(true);
  });

  it("結果はいつも 0 以上 360 未満", () => {
    for (const [prev, value] of [
      [359, 1],
      [1, 359],
      [0, 0],
      [180, 0],
    ]) {
      const next = smoothHeading(prev, value);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(360);
    }
  });
});

describe("shouldRotate（#69）", () => {
  it("決めた値のまま（5°）", () => {
    expect(ROTATE_THRESHOLD_DEGREES).toBe(5);
  });

  it("まだ回していなければ回す", () => {
    expect(shouldRotate(null, 30)).toBe(true);
  });

  it("5° 未満の変化では回さず、5° 以上で回す", () => {
    expect(shouldRotate(100, 104)).toBe(false);
    expect(shouldRotate(100, 105)).toBe(true);
    expect(shouldRotate(100, 95)).toBe(true);
  });

  it("0° をまたぐ変化も、近い向きの差で比べる", () => {
    expect(shouldRotate(358, 2)).toBe(false);
    expect(shouldRotate(358, 4)).toBe(true);
  });
});
