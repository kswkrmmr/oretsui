import { distanceBetween } from "@/lib/loop-route";
import type { LatLng } from "@/lib/start-point";

/**
 * 前回の進み具合から、この距離（m）先までの範囲でルート上の位置を探す。
 * 周回ルートは出発点とゴールが同じなので、全体から探すと歩き始めにゴールと判定してしまう
 */
export const SEARCH_AHEAD_M = 300;

/** ルートの始点から各点までの道のり（m）。先頭は 0、末尾は全長 */
export function cumulativeDistances(path: LatLng[]): number[] {
  const distances = [0];
  for (let i = 1; i < path.length; i++) {
    distances.push(distances[i - 1] + distanceBetween(path[i - 1], path[i]));
  }
  return distances;
}

/** position を原点とした平面の座標（m）。数百 m の範囲なら平面とみなしてよい */
function toLocal(origin: LatLng, point: LatLng) {
  const metersPerDegree = (Math.PI / 180) * 6_371_000;
  return {
    x:
      (point.lng - origin.lng) *
      metersPerDegree *
      Math.cos((origin.lat * Math.PI) / 180),
    y: (point.lat - origin.lat) * metersPerDegree,
  };
}

/**
 * 現在地から、ルート上でどこまで歩いたか（始点からの道のり、m）を求める。
 * previous（前回の値）から SEARCH_AHEAD_M 先までの範囲で、現在地にいちばん近い位置を選ぶ。
 * 後ろへは戻らない
 */
export function walkedDistance(
  path: LatLng[],
  position: LatLng,
  previous: number,
): number {
  const distances = cumulativeDistances(path);
  const limit = previous + SEARCH_AHEAD_M;
  let best = previous;
  let bestGap = Infinity;
  for (let i = 1; i < path.length; i++) {
    const startAt = distances[i - 1];
    const length = distances[i] - startAt;
    // 範囲と重ならない区間は飛ばす
    if (distances[i] < previous || startAt > limit) continue;
    const a = toLocal(position, path[i - 1]);
    const b = toLocal(position, path[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const squared = dx * dx + dy * dy;
    // 区間の上で現在地にいちばん近い点の割合（0〜1）
    let t = squared === 0 ? 0 : -(a.x * dx + a.y * dy) / squared;
    t = Math.min(1, Math.max(0, t));
    // 範囲の外にはみ出した分は、範囲の端に寄せる
    const along = Math.min(limit, Math.max(previous, startAt + t * length));
    const ratio = length === 0 ? 0 : (along - startAt) / length;
    const gap = Math.hypot(a.x + ratio * dx, a.y + ratio * dy);
    if (gap < bestGap) {
      bestGap = gap;
      best = along;
    }
  }
  return best;
}

/** ルートからこの距離（m）以上離れたら、外れているとみなす */
export const OFF_ROUTE_M = 50;

/** 外れた位置がこの回数続けて届いたら知らせる。GPS の一時的なずれで知らせないため */
export const OFF_ROUTE_COUNT = 2;

/** 現在地からルートの線までの最短距離（m） */
export function distanceToRoute(path: LatLng[], position: LatLng): number {
  if (path.length === 1) return distanceBetween(path[0], position);
  let nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = toLocal(position, path[i - 1]);
    const b = toLocal(position, path[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const squared = dx * dx + dy * dy;
    const t =
      squared === 0
        ? 0
        : Math.min(1, Math.max(0, -(a.x * dx + a.y * dy) / squared));
    nearest = Math.min(nearest, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return nearest;
}

/** 精度に合わせた外れの基準の、いちばん厳しい値（m）（#53） */
export const OFF_ROUTE_MIN_M = 25;
/** 精度に足す余裕（m）（#53） */
export const OFF_ROUTE_MARGIN_M = 15;
/** これより精度が悪い（m）位置は、外れの判定に使わない（#53） */
export const OFF_ROUTE_MAX_ACCURACY_M = 50;

/**
 * 外れの基準（m）。GPS の精度が良いときは厳しく、悪いときはゆるくする（#53）。
 * 「精度 + 15m」を 25m〜50m に収める。精度が取れないときは今までどおり 50m
 */
export function offRouteThreshold(accuracy: number | undefined): number {
  if (accuracy === undefined || Number.isNaN(accuracy)) return OFF_ROUTE_M;
  return Math.min(
    OFF_ROUTE_M,
    Math.max(OFF_ROUTE_MIN_M, accuracy + OFF_ROUTE_MARGIN_M),
  );
}

/**
 * 外れた位置が続けて届いた回数を数え直す。ルートに戻ったら 0 に戻す。
 * accuracy は位置の精度（m）。精度が悪すぎる位置は判定に使わず、回数をそのままにする（#53）
 */
export function countOffRoute(
  previous: number,
  distance: number,
  accuracy?: number,
): number {
  if (accuracy !== undefined && accuracy > OFF_ROUTE_MAX_ACCURACY_M)
    return previous;
  return distance >= offRouteThreshold(accuracy) ? previous + 1 : 0;
}

/** 外れたと知らせるか */
export function isOffRoute(count: number): boolean {
  return count >= OFF_ROUTE_COUNT;
}
