import { describe, expect, it } from "vitest";
import { nextReturnWalk, startReturnWalk } from "./return-walk";

// 東へ約 270m、そこから北へ約 220m で出発点に着く帰り道
const HOME_PATH = [
  { lat: 35.6895, lng: 139.6947 },
  { lat: 35.6895, lng: 139.6917 },
  { lat: 35.6915, lng: 139.6917 },
];

describe("帰り道の進み具合（#93）", () => {
  it("帰り道に入ったときは、帰り道を 0m 歩いたところから始め、それまでの距離を覚える", () => {
    const walk = startReturnWalk(HOME_PATH, 1200);
    expect(walk.walked).toBe(0);
    expect(walk.baseWalked).toBe(1200);
    expect(walk.total).toBeGreaterThan(480);
    expect(walk.total).toBeLessThan(500);
  });

  it("帰り道に沿って歩くと、帰り道を歩いた距離が増える", () => {
    let walk = startReturnWalk(HOME_PATH, 1200);
    ({ walk } = nextReturnWalk(walk, { lat: 35.6895, lng: 139.6932 }, 5, 0));
    expect(walk.walked).toBeGreaterThan(125);
    expect(walk.walked).toBeLessThan(145);
    ({ walk } = nextReturnWalk(walk, { lat: 35.6905, lng: 139.6917 }, 5, 0));
    expect(walk.walked).toBeGreaterThan(370);
  });

  it("外れの判定は、元のルートではなく帰り道との距離で数える", () => {
    const walk = startReturnWalk(HOME_PATH, 1200);
    // 帰り道の上
    expect(
      nextReturnWalk(walk, { lat: 35.6895, lng: 139.694 }, 5, 1).offRouteCount,
    ).toBe(0);
    // 帰り道から南へ約 110m
    expect(
      nextReturnWalk(walk, { lat: 35.6885, lng: 139.694 }, 5, 1).offRouteCount,
    ).toBe(2);
  });

  it("逆回りの判定は使わない（来た道を戻っても、逆回りにはならず、歩いた距離も減らない）", () => {
    let walk = startReturnWalk(HOME_PATH, 1200);
    ({ walk } = nextReturnWalk(walk, { lat: 35.6895, lng: 139.6917 }, 5, 0));
    const walked = walk.walked;
    expect(walked).toBeGreaterThan(260);
    // 来た道を東へ戻る
    for (const lng of [139.6925, 139.6935, 139.6945])
      ({ walk } = nextReturnWalk(walk, { lat: 35.6895, lng }, 5, 0));
    expect(walk.walked).toBe(walked);
    expect(walk.path).toBe(HOME_PATH);
  });
});
