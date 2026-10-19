import { describe, expect, it } from "vitest";
import { initialRotation, nextRotation } from "./rotation";
import { distanceBetween, loopWaypoints } from "./loop-route";

/** 2つの角度の差（0〜180°） */
const angleBetween = (a: number, b: number) => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

describe("initialRotation", () => {
  it("最初の回転角は 0〜360° のランダム", () => {
    expect(initialRotation(0)).toBe(0);
    expect(initialRotation(0.5)).toBe(180);
    expect(initialRotation(0.999)).toBeLessThan(360);
  });
});

describe("nextRotation", () => {
  it.each([0, 0.25, 0.5, 0.75, 0.999])(
    "前の回転角から 90〜270° ずらす（乱数 %s）",
    (random) => {
      for (const previous of [0, 45, 200, 350]) {
        const next = nextRotation(previous, random);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(360);
        const shift = (next - previous + 360) % 360;
        expect(shift).toBeGreaterThanOrEqual(90);
        expect(shift).toBeLessThanOrEqual(270);
      }
    },
  );

  it("乱数が 0 なら 90°、1 に近ければ 270° 近くずらす", () => {
    expect(nextRotation(300, 0)).toBe(30);
    expect(nextRotation(0, 0.5)).toBe(180);
    expect(nextRotation(10, 0.9999)).toBeCloseTo(280, 1);
  });

  it("再生成すると、前回と異なる経由地になる", () => {
    const start = { lat: 35.6895, lng: 139.6917 };
    const radius = 300;
    for (const random of [0, 0.5, 0.999]) {
      const previous = 120;
      const next = nextRotation(previous, random);
      expect(angleBetween(previous, next)).toBeGreaterThanOrEqual(90);
      const before = loopWaypoints(start, radius, previous);
      const after = loopWaypoints(start, radius, next);
      // 少なくとも1点は、半径以上離れた場所に変わる
      const moved = before.map((point, i) => distanceBetween(point, after[i]));
      expect(Math.max(...moved)).toBeGreaterThan(radius);
    }
  });
});
