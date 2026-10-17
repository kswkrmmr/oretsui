import { describe, expect, it, vi } from "vitest";
import {
  adjustRadius,
  destination,
  distanceBetween,
  findLoopRoute,
  initialRadius,
  isWithinTolerance,
  loopWaypoints,
  MAX_ATTEMPTS,
  type RouteResult,
} from "./loop-route";

const START = { lat: 35.6895, lng: 139.6917 };

/** 1m 未満の差は同じ距離とみなす（球面上の計算なので、わずかにずれる） */
function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(1);
}

function route(distanceMeters: number): RouteResult {
  return {
    distanceMeters,
    durationSeconds: distanceMeters,
    encodedPolyline: `line-${distanceMeters}`,
  };
}

describe("initialRadius", () => {
  it("目標距離を、道の遠回り（1.3倍）を見込んだ円周で割って半径にする", () => {
    expect(initialRadius(2600 * Math.PI)).toBeCloseTo(1000);
  });
});

describe("loopWaypoints", () => {
  const radius = 1000;

  it("経由地は3点で、出発点から √2r・2r・√2r の距離にある", () => {
    const waypoints = loopWaypoints(START, radius, 0);
    expect(waypoints).toHaveLength(3);
    const distances = waypoints.map((point) => distanceBetween(START, point));
    expectClose(distances[0], Math.SQRT2 * radius);
    expectClose(distances[1], 2 * radius);
    expectClose(distances[2], Math.SQRT2 * radius);
  });

  it("経由地はどれも、出発点から回転角の向きに r 進んだ点を中心とする円の上にある", () => {
    // 回転角 0 は北向き
    const center = destination(START, 0, radius);
    expect(center.lat).toBeGreaterThan(START.lat);
    expectClose(distanceBetween(START, center), radius);
    for (const point of loopWaypoints(START, radius, 0)) {
      expectClose(distanceBetween(center, point), radius);
    }
  });

  it("回転角が違えば、違う経由地になる", () => {
    const a = loopWaypoints(START, radius, 0);
    const b = loopWaypoints(START, radius, 90);
    for (let i = 0; i < a.length; i++) {
      expect(distanceBetween(a[i], b[i])).toBeGreaterThan(100);
    }
  });

  it("回転角が同じなら、同じ経由地になる", () => {
    expect(loopWaypoints(START, radius, 45)).toEqual(
      loopWaypoints(START, radius, 45),
    );
  });
});

describe("adjustRadius / isWithinTolerance", () => {
  it("実際の距離が長すぎたら半径を縮め、短すぎたら広げる", () => {
    expect(adjustRadius(1000, 2000, 4000)).toBe(500);
    expect(adjustRadius(1000, 2000, 1000)).toBe(2000);
  });

  it("目標の ±10% を範囲内とする", () => {
    expect(isWithinTolerance(2000, 1800)).toBe(true);
    expect(isWithinTolerance(2000, 2200)).toBe(true);
    expect(isWithinTolerance(2000, 1799)).toBe(false);
    expect(isWithinTolerance(2000, 2201)).toBe(false);
  });
});

describe("findLoopRoute", () => {
  it("1回目で ±10% に入れば、それ以上 API を呼ばない", async () => {
    const fetchRoute = vi.fn().mockResolvedValue(route(2100));
    const result = await findLoopRoute(START, 2000, 0, fetchRoute);
    expect(fetchRoute).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      route: route(2100),
      withinTolerance: true,
    });
    expect(result!.waypoints).toEqual(fetchRoute.mock.calls[0][1]);
  });

  it("外れたら半径を調整して呼び直し、±10% に収束したルートを返す", async () => {
    const fetchRoute = vi
      .fn()
      .mockResolvedValueOnce(route(4000))
      .mockResolvedValueOnce(route(2050));
    const result = await findLoopRoute(START, 2000, 0, fetchRoute);
    expect(fetchRoute).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ route: route(2050), withinTolerance: true });

    // 2回目は、半径を 2000 / 4000 = 半分にした経由地で呼ぶ
    const radius = initialRadius(2000);
    expect(fetchRoute.mock.calls[0][1]).toEqual(
      loopWaypoints(START, radius, 0),
    );
    expect(fetchRoute.mock.calls[1][1]).toEqual(
      loopWaypoints(START, radius / 2, 0),
    );
    expect(fetchRoute.mock.calls[1][0]).toEqual(START);
  });

  it("4回で収束しなければ、目標に一番近かったルートを返す", async () => {
    const fetchRoute = vi
      .fn()
      .mockResolvedValueOnce(route(3000))
      .mockResolvedValueOnce(route(1500))
      .mockResolvedValueOnce(route(2400))
      .mockResolvedValueOnce(route(1700))
      .mockResolvedValue(route(2000));
    const result = await findLoopRoute(START, 2000, 0, fetchRoute);
    expect(MAX_ATTEMPTS).toBe(4);
    expect(fetchRoute).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({
      route: route(1700),
      withinTolerance: false,
    });
    expect(result!.waypoints).toEqual(fetchRoute.mock.calls[3][1]);
  });

  it("ルートが取れなかったときは、それまでで一番近いルートを返す", async () => {
    const fetchRoute = vi
      .fn()
      .mockResolvedValueOnce(route(3000))
      .mockResolvedValueOnce(null);
    const result = await findLoopRoute(START, 2000, 0, fetchRoute);
    expect(fetchRoute).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      route: route(3000),
      withinTolerance: false,
    });
  });

  it("1本もルートが取れなければ null を返す", async () => {
    const fetchRoute = vi.fn().mockResolvedValue(null);
    expect(await findLoopRoute(START, 2000, 0, fetchRoute)).toBeNull();
  });
});
