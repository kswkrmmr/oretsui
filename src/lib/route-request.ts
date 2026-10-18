import type { LatLng } from "@/lib/start-point";

/** ルート検索 API（POST /api/route）の返事 */
export type LoopRouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  waypoints: LatLng[];
  withinTolerance: boolean;
};

/** 出発点に戻ってくる、目標距離に近いルートをサーバーに頼む。失敗したら例外を投げる */
export async function requestLoopRoute(
  start: LatLng,
  meters: number,
): Promise<LoopRouteResponse> {
  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, meters }),
  });
  if (!response.ok) {
    throw new Error(`ルート検索に失敗しました（${response.status}）`);
  }
  return (await response.json()) as LoopRouteResponse;
}
