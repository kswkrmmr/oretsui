import { describe, expect, it } from "vitest";
import { decodePolyline } from "./polyline";
import {
  DECIDE_WITHIN_M,
  initialWalkDirection,
  nextWalkDirection,
  REVERSE_CLOSER_M,
  REVERSE_LEAD_M,
} from "./walk-direction";

// 北緯35.69度付近。緯度 1° ≒ 111.2km、経度 1° ≒ 90.3km
const START = { lat: 35.6895, lng: 139.6917 };
const north = (m: number, from = START) => ({
  lat: from.lat + m / 111_195,
  lng: from.lng,
});
const south = (m: number, from = START) => north(-m, from);
const east = (m: number, from = START) => ({
  lat: from.lat,
  lng: from.lng + m / 90_300,
});

// 出発点から北へ約300m → 東へ約300m → 南へ約300m → 西へ出発点に戻る正方形。
// 順回りは北へ、逆回りは東へ歩き出す（出発点で直角に分かれる）
const SQUARE = decodePolyline("kryxEcprsY{O??sSzO??rS");

// 出発点から東へ約20m の角までは、行きも帰りも同じ道。
// 角から順回りは北へ、逆回りは南へ進む（#60：実際に歩いて切り替わらなかった形）
const SHARED = decodePolyline("kryxEcprsY?k@{O??sSv`@??rS{O??j@");
const CORNER = SHARED[1];

/** 位置を順に届けたあとの向きの状態 */
function walkThrough(
  path: { lat: number; lng: number }[],
  positions: { lat: number; lng: number }[],
) {
  let state = initialWalkDirection();
  for (const position of positions)
    state = nextWalkDirection(state, path, position).state;
  return state;
}

describe("テスト用のルート", () => {
  it("正方形は、出発点から北へ進む", () => {
    expect(SQUARE[0]).toEqual(START);
    expect(SQUARE[1].lat).toBeGreaterThan(START.lat);
    expect(SQUARE[1].lng).toBeCloseTo(START.lng, 6);
  });

  it("同じ道を共有するルートは、東へ約20m の角から北へ進み、最後は南から角に戻って出発点へ戻る", () => {
    expect(SHARED[0]).toEqual(START);
    expect(CORNER.lat).toBeCloseTo(START.lat, 6);
    expect(CORNER.lng - START.lng).toBeCloseTo(20 / 90_300, 5);
    expect(SHARED[2].lat).toBeGreaterThan(CORNER.lat);
    expect(SHARED.at(-2)).toEqual(CORNER);
    expect(SHARED.at(-3)!.lat).toBeLessThan(CORNER.lat);
    expect(SHARED.at(-1)).toEqual(START);
  });
});

describe("逆回りの判定（#52、#60 で「差」に変更）", () => {
  it("決めた値のまま（逆回りが順回りより 30m 多い・逆回りの点が 10m 以上近い・最初の 300m）", () => {
    expect(REVERSE_LEAD_M).toBe(30);
    expect(REVERSE_CLOSER_M).toBe(10);
    expect(DECIDE_WITHIN_M).toBe(300);
  });

  it("順回りに歩いたら切り替えない", () => {
    const state = walkThrough(SQUARE, [north(20), north(50), north(80)]);
    expect(state.reversed).toBe(false);
    expect(state.walked).toBeCloseTo(80, -1);
  });

  it("直角に分かれるルートで、逆向きに 30m 歩いたら切り替える", () => {
    let state = initialWalkDirection();
    const first = nextWalkDirection(state, SQUARE, east(20));
    expect(first.switched).toBe(false);
    state = first.state;
    const second = nextWalkDirection(state, SQUARE, east(35));
    expect(second.switched).toBe(true);
    expect(second.state.reversed).toBe(true);
    // 逆回りの歩いた距離として数える
    expect(second.state.walked).toBeCloseTo(35, -1);
  });

  it("差が 30m に届かなければ切り替えない", () => {
    expect(walkThrough(SQUARE, [east(10), east(25)]).reversed).toBe(false);
  });

  it("300m を過ぎたら、逆向きに歩いても切り替えない", () => {
    // 順回りに 300m 歩いて向きが決まったあと、出発点に戻って逆向きへ
    const state = walkThrough(SQUARE, [
      north(100),
      north(200),
      north(290),
      east(10, north(300)),
      START,
      east(50),
    ]);
    expect(state.decided).toBe(true);
    expect(state.reversed).toBe(false);
  });

  it("1回の位置の更新で逆向きに 300m を超えたら（GPS が大きく飛んだとき）、切り替えずに向きを固定する", () => {
    // 逆回りの最初の角（南東、出発点から東へ約298m）を曲がって北へ 20m。逆回りで約318m の位置
    const southEast = SQUARE.at(-2)!;
    const { state, switched } = nextWalkDirection(
      initialWalkDirection(),
      SQUARE,
      north(20, southEast),
    );
    expect(switched).toBe(false);
    expect(state.reversed).toBe(false);
    expect(state.decided).toBe(true);
  });

  it("一度逆回りに切り替えたら、順回りへは戻らない", () => {
    const state = walkThrough(SQUARE, [east(20), east(45), START, north(50)]);
    expect(state.reversed).toBe(true);
  });

  it("逆回りのあとは、歩いた距離が逆回りの道のりで増えていく", () => {
    const state = walkThrough(SQUARE, [
      east(20),
      east(45),
      east(100),
      east(200),
    ]);
    expect(state.reversed).toBe(true);
    expect(state.walked).toBeCloseTo(200, -1);
  });
});

describe("最初の道を行きと帰りで共有するルート（#60：実際に歩いて切り替わらなかった形）", () => {
  it("同じ道を歩いている間は切り替えない", () => {
    const state = walkThrough(SHARED, [east(10), east(20)]);
    expect(state.reversed).toBe(false);
    // どちらの向きでも同じだけ進んでいる
    expect(state.forward).toBeCloseTo(20, -1);
    expect(state.reverse).toBeCloseTo(20, -1);
  });

  it("同じ道を歩いたあと、角から逆回りの道（南）へ 35m 進むと切り替える", () => {
    const state = walkThrough(SHARED, [
      east(10),
      east(20),
      south(15, CORNER),
      south(35, CORNER),
    ]);
    expect(state.reversed).toBe(true);
    // 逆回りの歩いた距離：同じ道の約20m + 南へ35m
    expect(state.walked).toBeCloseTo(55, -1);
  });

  it("同じ道を歩いたあと、角から順回りの道（北）へ進めば切り替えない", () => {
    const state = walkThrough(SHARED, [
      east(10),
      east(20),
      north(35, CORNER),
      north(80, CORNER),
    ]);
    expect(state.reversed).toBe(false);
    expect(state.walked).toBeCloseTo(100, -1);
  });
});

describe("帰り道が隣の筋を平行に通るルート（#60 のレビューで見つかった誤判定）", () => {
  // 北へ200m → 東へ width → 南へ200m → 西へ width で出発点に戻る細長い周回
  const narrowLoop = (width: number) => [
    START,
    north(200),
    east(width, north(200)),
    east(width),
    START,
  ];

  it.each([30, 40, 60])(
    "隣の筋が %im 離れていても、順回りの道を北へ歩けば切り替えない",
    (width) => {
      const positions = Array.from({ length: 30 }, (_, i) =>
        north(5 * (i + 1)),
      );
      const state = walkThrough(narrowLoop(width), positions);
      expect(state.reversed).toBe(false);
      expect(state.walked).toBeCloseTo(150, -1);
    },
  );

  it("出発点から逆回りの道（東）へ歩けば切り替える", () => {
    // 逆回りは出発点から東へ width 進んでから北へ向かう。東へ 40m 進むと逆回りの道の上
    const state = walkThrough(narrowLoop(60), [east(20), east(40)]);
    expect(state.reversed).toBe(true);
  });
});
