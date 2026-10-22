// 散歩中、向いている方角を上にして地図を回すための計算（#69）

/** 地図を回すのは、前回回したときからこの角度（°）以上変わったときだけ（ふらつき対策） */
export const ROTATE_THRESHOLD_DEGREES = 5;

/** なめらかにするとき、届いた値へどれだけ近づけるか（0〜1） */
const SMOOTHING = 0.3;

/** 0 以上 360 未満にそろえる */
const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;

/** a から b へ、近い向きに回ったときの角度の差（−180 より大きく 180 以下） */
const shortestDelta = (a: number, b: number) => {
  const delta = normalize(b - a);
  return delta > 180 ? delta - 360 : delta;
};

/**
 * 端末の向きのイベントから、向いている方角（北が 0°、時計回り）を取り出す。
 * - iPhone（Safari）：webkitCompassHeading
 * - Android（Chrome）：deviceorientationabsolute の alpha（方角 = 360 − alpha）
 * 方角が分からなければ null
 */
export function headingFromEvent(event: {
  webkitCompassHeading?: number | null;
  alpha: number | null;
  absolute?: boolean;
}): number | null {
  if (typeof event.webkitCompassHeading === "number")
    return normalize(event.webkitCompassHeading);
  if (event.absolute && typeof event.alpha === "number")
    return normalize(360 - event.alpha);
  return null;
}

/** 前回の方角から、届いた方角へ少しずつ近づける。0° をまたぐときも近い向きへ回る */
export function smoothHeading(previous: number | null, value: number): number {
  if (previous === null) return normalize(value);
  return normalize(previous + shortestDelta(previous, value) * SMOOTHING);
}

/** 前回地図を回した向きから ROTATE_THRESHOLD_DEGREES 以上変わったら回す */
export function shouldRotate(lastApplied: number | null, heading: number) {
  if (lastApplied === null) return true;
  return (
    Math.abs(shortestDelta(lastApplied, heading)) >= ROTATE_THRESHOLD_DEGREES
  );
}
