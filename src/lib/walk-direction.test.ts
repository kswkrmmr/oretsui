import { describe, expect, it } from "vitest";
import { decodePolyline } from "./polyline";
import {
  DECIDE_WITHIN_M,
  initialWalkDirection,
  nextWalkDirection,
  REVERSE_MIN_M,
} from "./walk-direction";

// 出発点から北へ約300m → 東へ約300m → 南へ約300m → 西へ出発点に戻る正方形。
// 順回りは北へ、逆回りは東へ歩き出す（出発点で直角に分かれる）
const SQUARE = decodePolyline("kryxEcprsY{O??sSzO??rS");
const START = SQUARE[0];
// 北緯35.69度付近。緯度 1° ≒ 111.2km、経度 1° ≒ 90.3km
const north = (m: number) => ({ lat: START.lat + m / 111_195, lng: START.lng });
const east = (m: number) => ({ lat: START.lat, lng: START.lng + m / 90_300 });

/** 位置を順に届けたあとの向きの状態 */
function walkThrough(positions: { lat: number; lng: number }[]) {
  let state = initialWalkDirection();
  for (const position of positions)
    state = nextWalkDirection(state, SQUARE, position).state;
  return state;
}

describe("逆回りの判定（#52）", () => {
  it("決めた値のまま（逆向き 40m・順向き 10m 未満・最初の 150m）", () => {
    expect(REVERSE_MIN_M).toBe(40);
    expect(DECIDE_WITHIN_M).toBe(150);
  });

  it("テスト用の正方形は、出発点から北へ進む", () => {
    expect(SQUARE[1].lat).toBeGreaterThan(START.lat);
    expect(SQUARE[1].lng).toBeCloseTo(START.lng, 6);
  });

  it("順回りに歩いたら切り替えない", () => {
    const state = walkThrough([north(20), north(50), north(80)]);
    expect(state.reversed).toBe(false);
    expect(state.walked).toBeCloseTo(80, -1);
  });

  it("逆向きに 40m 歩いたら（順回りは 10m 未満）逆回りに切り替える", () => {
    let state = initialWalkDirection();
    const first = nextWalkDirection(state, SQUARE, east(20));
    expect(first.switched).toBe(false);
    state = first.state;
    const second = nextWalkDirection(state, SQUARE, east(45));
    expect(second.switched).toBe(true);
    expect(second.state.reversed).toBe(true);
    // 逆回りの歩いた距離として数える
    expect(second.state.walked).toBeCloseTo(45, -1);
  });

  it("逆向きでも 40m に届かなければ切り替えない", () => {
    expect(walkThrough([east(20), east(35)]).reversed).toBe(false);
  });

  it("150m を過ぎたら、逆向きに歩いても切り替えない", () => {
    // 順回りに 160m 歩いて向きが決まったあと、出発点に戻って逆向きへ
    const state = walkThrough([
      north(50),
      north(100),
      north(160),
      START,
      east(50),
    ]);
    expect(state.decided).toBe(true);
    expect(state.reversed).toBe(false);
  });

  it("1回の位置の更新で逆向きに 150m を超えたら（GPS が大きく飛んだとき）、切り替えずに向きを固定する", () => {
    // 順回りは 0m のまま、逆回りが 0m から 160m へ一気に増える。
    // 150m に達した時点で判定は終わるので、40m・10m の条件を満たしていても切り替えない
    const { state, switched } = nextWalkDirection(
      initialWalkDirection(),
      SQUARE,
      east(160),
    );
    expect(switched).toBe(false);
    expect(state.reversed).toBe(false);
    expect(state.decided).toBe(true);
  });

  it("一度逆回りに切り替えたら、順回りへは戻らない", () => {
    const state = walkThrough([east(20), east(45), START, north(50)]);
    expect(state.reversed).toBe(true);
  });

  it("逆回りのあとは、歩いた距離が逆回りの道のりで増えていく", () => {
    const state = walkThrough([east(20), east(45), east(100), east(200)]);
    expect(state.reversed).toBe(true);
    expect(state.walked).toBeCloseTo(200, -1);
  });
});
