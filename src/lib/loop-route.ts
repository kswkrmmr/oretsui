import type { LatLng } from "@/lib/start-point";

/** 道は直線より遠回りになるので、その分を見込む係数 */
export const ROAD_FACTOR = 1.3;

/** 目標距離に対して許す誤差（±10%） */
export const TOLERANCE = 0.1;

/** Routes API を呼ぶ最大回数（最初の1回＋調整のやり直し3回） */
export const MAX_ATTEMPTS = 4;

/** 円の上に置く経由地の数 */
export const WAYPOINT_COUNT = 3;

const EARTH_RADIUS_M = 6_371_000;

/** Routes API から受け取った1本のルート */
export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

/** 出発点と経由地からルートを取得する。ルートが取れなければ null */
export type FetchRoute = (
  start: LatLng,
  waypoints: LatLng[],
) => Promise<RouteResult | null>;

export type LoopRoute = {
  route: RouteResult;
  waypoints: LatLng[];
  withinTolerance: boolean;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** 2点間の距離（m）。地球を球とみなす */
export function distanceBetween(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** origin から方角 bearing（度、北が 0 で時計回り）へ meters 進んだ点 */
export function destination(
  origin: LatLng,
  bearing: number,
  meters: number,
): LatLng {
  const angle = meters / EARTH_RADIUS_M;
  const theta = toRadians(bearing);
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angle) +
      Math.cos(lat1) * Math.sin(angle) * Math.cos(theta),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angle) * Math.cos(lat1),
      Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
}

/** 目標距離から、最初に試す円の半径（m）を見積もる */
export function initialRadius(targetMeters: number): number {
  return targetMeters / (2 * Math.PI * ROAD_FACTOR);
}

/**
 * 出発点を通る半径 radius の円の上に、経由地を置く。
 * 円の中心は出発点から回転角 rotation（度）の向きに radius 進んだ点で、
 * 経由地は円の中心から見て、出発点から 90°・180°・270° 回った位置に置く
 */
export function loopWaypoints(
  start: LatLng,
  radius: number,
  rotation: number,
): LatLng[] {
  const center = destination(start, rotation, radius);
  // 円の中心から見た出発点の方角
  const startBearing = rotation + 180;
  return Array.from({ length: WAYPOINT_COUNT }, (_, i) =>
    destination(
      center,
      startBearing + (360 / (WAYPOINT_COUNT + 1)) * (i + 1),
      radius,
    ),
  );
}

/** 実際の距離と目標距離の比で、半径を直す */
export function adjustRadius(
  radius: number,
  targetMeters: number,
  actualMeters: number,
): number {
  return radius * (targetMeters / actualMeters);
}

/** 実際の距離が目標の ±10% に入っているか */
export function isWithinTolerance(
  targetMeters: number,
  actualMeters: number,
): boolean {
  return Math.abs(actualMeters - targetMeters) <= targetMeters * TOLERANCE;
}

/**
 * 目標距離に近い周回ルートを探す。±10% に入るまで半径を調整し、最大 MAX_ATTEMPTS 回試す。
 * 入らなければ目標に一番近かったルートを返し、1本も取れなければ null を返す
 */
export async function findLoopRoute(
  start: LatLng,
  targetMeters: number,
  rotation: number,
  fetchRoute: FetchRoute,
): Promise<LoopRoute | null> {
  let radius = initialRadius(targetMeters);
  let best: LoopRoute | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const waypoints = loopWaypoints(start, radius, rotation);
    const route = await fetchRoute(start, waypoints);
    // 距離が分からないと半径を直せないので、ここで打ち切る
    if (!route || route.distanceMeters <= 0) break;
    const withinTolerance = isWithinTolerance(
      targetMeters,
      route.distanceMeters,
    );
    const candidate = { route, waypoints, withinTolerance };
    if (withinTolerance) return candidate;
    if (
      !best ||
      Math.abs(route.distanceMeters - targetMeters) <
        Math.abs(best.route.distanceMeters - targetMeters)
    ) {
      best = candidate;
    }
    radius = adjustRadius(radius, targetMeters, route.distanceMeters);
  }
  return best;
}
