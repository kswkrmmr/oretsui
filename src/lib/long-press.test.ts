import { describe, expect, it } from "vitest";
import { movedTooFar, pixelToWorldPoint } from "./long-press";

describe("pixelToWorldPoint", () => {
  const size = { width: 400, height: 800 };
  const center = { x: 100, y: 50 };

  it("地図のまんなかを押すと、中心と同じ位置になる", () => {
    expect(pixelToWorldPoint(center, 15, size, { x: 200, y: 400 })).toEqual(
      center,
    );
  });

  it("ズーム n では、2^n ピクセルがワールド座標の 1 にあたる", () => {
    expect(pixelToWorldPoint(center, 2, size, { x: 204, y: 392 })).toEqual({
      x: 101,
      y: 48,
    });
  });
});

describe("movedTooFar", () => {
  const start = { x: 100, y: 100 };

  it("10px 未満の動きは、指のぶれとして許す", () => {
    expect(movedTooFar(start, { x: 106, y: 107 })).toBe(false);
  });

  it("10px 以上動いたら、ドラッグとみなす", () => {
    expect(movedTooFar(start, { x: 106, y: 108 })).toBe(true);
  });
});
