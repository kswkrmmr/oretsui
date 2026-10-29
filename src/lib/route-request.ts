import type { LatLng } from "@/lib/start-point";

/** ルート検索 API（POST /api/route）の返事 */
export type LoopRouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  waypoints: LatLng[];
  withinTolerance: boolean;
};

/**
 * 出発点に戻ってくる、目標距離に近いルートをサーバーに頼む。失敗したら例外を投げる。
 * rotation は円の向き（度）。変えると違うルートになる
 */
export async function requestLoopRoute(
  start: LatLng,
  meters: number,
  rotation: number,
): Promise<LoopRouteResponse> {
  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, meters, rotation }),
  });
  if (!response.ok) {
    throw new Error(`ルート検索に失敗しました（${response.status}）`);
  }
  return (await response.json()) as LoopRouteResponse;
}

/** 帰り道（POST /api/return）の返事（#93） */
export type ReturnRouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

/** 今いる場所（from）から出発点（to）までの帰り道をサーバーに頼む。失敗したら例外を投げる（#93） */
export async function requestReturnRoute(
  from: LatLng,
  to: LatLng,
): Promise<ReturnRouteResponse> {
  const response = await fetch("/api/return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!response.ok) {
    throw new Error(`帰り道の検索に失敗しました（${response.status}）`);
  }
  return (await response.json()) as ReturnRouteResponse;
}
