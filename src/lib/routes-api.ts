import type { RouteResult } from "@/lib/loop-route";
import type { LatLng } from "@/lib/start-point";

export const ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

// 料金を抑えるため、受け取る項目を絞る
const FIELD_MASK =
  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";

/** Routes API がエラーを返した */
export class RoutesApiError extends Error {
  constructor(readonly status: number) {
    super(`Routes API がエラーを返しました（${status}）`);
    this.name = "RoutesApiError";
  }
}

type ComputeRoutesResponse = {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }[];
};

const waypoint = ({ lat, lng }: LatLng) => ({
  location: { latLng: { latitude: lat, longitude: lng } },
});

/**
 * 出発点から経由地を回って出発点に戻る、徒歩ルートを取得する。
 * サーバー側からだけ呼ぶ（API キーをブラウザに出さない）
 */
export function computeWalkingRoute(
  apiKey: string,
  start: LatLng,
  waypoints: LatLng[],
  fetchImpl: typeof fetch = fetch,
): Promise<RouteResult | null> {
  return computeRoute(apiKey, start, start, waypoints, fetchImpl);
}

/** from から to までの、片道の徒歩ルートを取得する（帰り道。#93）。サーバー側からだけ呼ぶ */
export function computeWalkingRouteTo(
  apiKey: string,
  from: LatLng,
  to: LatLng,
  fetchImpl: typeof fetch = fetch,
): Promise<RouteResult | null> {
  return computeRoute(apiKey, from, to, [], fetchImpl);
}

async function computeRoute(
  apiKey: string,
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  fetchImpl: typeof fetch,
): Promise<RouteResult | null> {
  const response = await fetchImpl(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      origin: waypoint(origin),
      destination: waypoint(destination),
      intermediates: waypoints.map(waypoint),
      travelMode: "WALK",
    }),
  });
  if (!response.ok) throw new RoutesApiError(response.status);

  const data = (await response.json()) as ComputeRoutesResponse;
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    distanceMeters: route.distanceMeters ?? 0,
    // 所要時間は "1800s" のような文字列で返ってくる
    durationSeconds: Number.parseFloat(route.duration ?? "0"),
    encodedPolyline: route.polyline?.encodedPolyline ?? "",
  };
}
