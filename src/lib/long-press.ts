/** 画面上の位置（ピクセル）や、地図のワールド座標 */
export type Point = { x: number; y: number };

/** この時間だけ押し続けたら長押しとみなす（ミリ秒） */
export const LONG_PRESS_MS = 500;

/** これ以上指が動いたら、長押しではなくドラッグとみなす（ピクセル） */
export const MOVE_TOLERANCE_PX = 10;

/** 指が許容範囲を超えて動いたか */
export function movedTooFar(start: Point, now: Point): boolean {
  return Math.hypot(now.x - start.x, now.y - start.y) >= MOVE_TOLERANCE_PX;
}

/**
 * 地図の中のピクセル位置を、ワールド座標（Google マップの投影座標）に変える。
 * ズーム n ではワールド座標の 1 が 2^n ピクセルにあたる。地図は回転・傾斜していない前提
 */
export function pixelToWorldPoint(
  centerWorld: Point,
  zoom: number,
  size: { width: number; height: number },
  pixel: Point,
): Point {
  const scale = 2 ** zoom;
  return {
    x: centerWorld.x + (pixel.x - size.width / 2) / scale,
    y: centerWorld.y + (pixel.y - size.height / 2) / scale,
  };
}
