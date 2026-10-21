import { describe, expect, it } from "vitest";
import { ANIKI_LEAD_M, anikiPosition, pointAlong } from "./route-direction";
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

describe("anikiPosition（#51）", () => {
  it("歩いた距離 + 10m のルート上の点になる（#59 で 30m から変更）", () => {
    expect(ANIKI_LEAD_M).toBe(10);
    // まだ歩いていなければ、出発点から 10m 先
    expect(anikiPosition(PATH, 0)).toEqual(pointAlong(PATH, 10));
    expect(distanceBetween(A, anikiPosition(PATH, 0)!)).toBeCloseTo(10, 0);
    // 105m 歩いたら、115m 先（曲がった後の区間）
    expect(anikiPosition(PATH, 105)).toEqual(pointAlong(PATH, 115));
  });

  it("全長に近いときは終点で止まる", () => {
    const total = distanceBetween(A, B) + distanceBetween(B, C);
    expect(anikiPosition(PATH, total - 5)).toEqual(C);
    expect(anikiPosition(PATH, total)).toEqual(C);
  });

  it("ルートがないときは兄貴を出さない（null）", () => {
    expect(anikiPosition([], 0)).toBeNull();
    expect(anikiPosition([A], 0)).toBeNull();
  });
});
