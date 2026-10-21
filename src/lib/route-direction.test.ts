import { describe, expect, it } from "vitest";
import {
  ANIKI_LEAD_M,
  anikiPosition,
  compassName,
  firstDirection,
  pointAlong,
} from "./route-direction";
import { distanceBetween } from "./loop-route";

// 北緯35度付近。緯度 0.001° ≒ 111m、経度 0.001° ≒ 91m
const A = { lat: 35, lng: 139 };
const B = { lat: 35.001, lng: 139 }; // A から北へ約111m
const C = { lat: 35.001, lng: 139.001 }; // B から東へ約91m
const PATH = [A, B, C];

describe("pointAlong", () => {
  it("区間の途中の点を求める", () => {
    const point = pointAlong(PATH, 50);
    expect(distanceBetween(A, point)).toBeCloseTo(50, 0);
    expect(point.lng).toBeCloseTo(139, 6);
    expect(point.lat).toBeGreaterThan(A.lat);
  });

  it("区間の境目ちょうどなら、その点になる", () => {
    const point = pointAlong(PATH, distanceBetween(A, B));
    expect(point.lat).toBeCloseTo(B.lat, 6);
    expect(point.lng).toBeCloseTo(B.lng, 6);
  });

  it("2つ目の区間に入ったら、その区間の上の点になる", () => {
    const point = pointAlong(PATH, distanceBetween(A, B) + 40);
    expect(point.lat).toBeCloseTo(B.lat, 6);
    expect(distanceBetween(B, point)).toBeCloseTo(40, 0);
  });

  it("全長を超えたら終点になる", () => {
    expect(pointAlong(PATH, 10_000)).toEqual(C);
  });

  it("0 以下なら始点になる", () => {
    expect(pointAlong(PATH, 0)).toEqual(A);
    expect(pointAlong(PATH, -5)).toEqual(A);
  });
});

describe("compassName", () => {
  const center = { lat: 35, lng: 139 };
  // 中心から各方角へ少し進んだ点（緯度と経度の 1° の長さの違いを補正する）
  const toward = (degrees: number) => {
    const rad = (degrees * Math.PI) / 180;
    return {
      lat: center.lat + 0.001 * Math.cos(rad),
      lng:
        center.lng +
        (0.001 * Math.sin(rad)) / Math.cos((center.lat * Math.PI) / 180),
    };
  };

  it.each([
    [0, "北"],
    [45, "北東"],
    [90, "東"],
    [135, "南東"],
    [180, "南"],
    [225, "南西"],
    [270, "西"],
    [315, "北西"],
  ])("%i° は %s", (degrees, name) => {
    expect(compassName(center, toward(degrees))).toBe(name);
  });

  it("境目の 22.5° をはさんで北と北東に分かれる", () => {
    expect(compassName(center, toward(22))).toBe("北");
    expect(compassName(center, toward(23))).toBe("北東");
  });

  it("北西と北の境目（337.5°）をはさんで分かれる", () => {
    expect(compassName(center, toward(337))).toBe("北西");
    expect(compassName(center, toward(338))).toBe("北");
  });
});

describe("firstDirection", () => {
  it("出発点からルートに沿って 50m 進んだ点への向きになる", () => {
    // 最初の約111m は北へ進む
    expect(firstDirection(PATH)).toBe("北");
  });

  it("最初の区間が 50m より短ければ、曲がった先の点への向きになる", () => {
    const shortFirst = [
      A,
      { lat: 35.0002, lng: 139 },
      { lat: 35.0002, lng: 139.002 },
    ];
    // 約22m 北へ進んでから東へ曲がり、約28m 進んだ点。出発点から見て約52°なので北東
    expect(firstDirection(shortFirst)).toBe("北東");
  });

  it("ルートが 50m より短ければ終点への向きになる", () => {
    expect(firstDirection([A, { lat: 34.9998, lng: 139 }])).toBe("南");
  });

  it("点が1つ以下なら方角は分からない", () => {
    expect(firstDirection([A])).toBeNull();
    expect(firstDirection([])).toBeNull();
  });
});

describe("anikiPosition（#51）", () => {
  it("歩いた距離 + 30m のルート上の点になる", () => {
    expect(ANIKI_LEAD_M).toBe(30);
    // まだ歩いていなければ、出発点から 30m 先
    expect(anikiPosition(PATH, 0)).toEqual(pointAlong(PATH, 30));
    expect(distanceBetween(A, anikiPosition(PATH, 0)!)).toBeCloseTo(30, 0);
    // 100m 歩いたら、130m 先（曲がった後の区間）
    expect(anikiPosition(PATH, 100)).toEqual(pointAlong(PATH, 130));
  });

  it("全長に近いときは終点で止まる", () => {
    const total = distanceBetween(A, B) + distanceBetween(B, C);
    expect(anikiPosition(PATH, total - 10)).toEqual(C);
    expect(anikiPosition(PATH, total)).toEqual(C);
  });

  it("ルートがないときは兄貴を出さない（null）", () => {
    expect(anikiPosition([], 0)).toBeNull();
    expect(anikiPosition([A], 0)).toBeNull();
  });
});
