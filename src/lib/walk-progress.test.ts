import { describe, expect, it } from "vitest";
import { distanceBetween } from "./loop-route";
import {
  cumulativeDistances,
  SEARCH_AHEAD_M,
  walkedDistance,
} from "./walk-progress";

// 出発点から北へ、東へ、出発点へ戻る三角形の周回ルート
const A = { lat: 35.6895, lng: 139.6917 };
const B = { lat: 35.6935, lng: 139.6917 };
const C = { lat: 35.6935, lng: 139.6967 };
const LOOP = [A, B, C, A];
const AB = distanceBetween(A, B);

describe("cumulativeDistances", () => {
  it("始点から各点までの道のりを返す", () => {
    const distances = cumulativeDistances(LOOP);
    expect(distances).toHaveLength(4);
    expect(distances[0]).toBe(0);
    expect(distances[1]).toBeCloseTo(AB, 5);
    expect(distances[3]).toBeCloseTo(
      AB + distanceBetween(B, C) + distanceBetween(C, A),
      5,
    );
  });
});

describe("walkedDistance", () => {
  it("ルート上の現在地から、始点からの道のりを求める", () => {
    const middle = { lat: 35.6915, lng: 139.6917 };
    expect(walkedDistance(LOOP, middle, 0)).toBeCloseTo(AB / 2, 0);
  });

  it("ルートから少し外れていても、いちばん近い位置で進み具合を求める", () => {
    // 区間 A→B の真ん中から、東へ 20m ほど外れた場所
    const beside = { lat: 35.6915, lng: 139.6919 };
    expect(walkedDistance(LOOP, beside, 0)).toBeCloseTo(AB / 2, 0);
  });

  it("周回ルートの出発点にいるときは、ゴールではなく 0 とみなす", () => {
    expect(walkedDistance(LOOP, A, 0)).toBe(0);
  });

  it("後ろへは戻らない", () => {
    const middle = { lat: 35.6915, lng: 139.6917 };
    expect(walkedDistance(LOOP, A, AB / 2)).toBe(AB / 2);
    expect(walkedDistance(LOOP, middle, AB)).toBe(AB);
  });

  it("前回から SEARCH_AHEAD_M より先へは一度に進まない", () => {
    // 1周の最後（出発点のすぐ手前）にいても、前回が 0 なら探す範囲の端までしか進まない
    const nearGoal = { lat: 35.68955, lng: 139.69175 };
    expect(walkedDistance(LOOP, nearGoal, 0)).toBeLessThanOrEqual(
      SEARCH_AHEAD_M,
    );
  });

  it("前回の位置が終盤なら、出発点に戻ってきたときに全長まで進む", () => {
    const total = cumulativeDistances(LOOP)[3];
    expect(walkedDistance(LOOP, A, total - 100)).toBeCloseTo(total, 5);
  });
});
