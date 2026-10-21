import type { LatLng } from "@/lib/start-point";
import { cumulativeDistances } from "@/lib/walk-progress";

/**
 * ルートの始点から、ルートに沿って meters 進んだ点。
 * 0 以下なら始点、全長を超えたら終点
 */
export function pointAlong(path: LatLng[], meters: number): LatLng {
  if (path.length === 0) throw new Error("ルートに点がありません");
  if (meters <= 0) return path[0];
  const distances = cumulativeDistances(path);
  for (let i = 1; i < path.length; i++) {
    if (distances[i] < meters) continue;
    const length = distances[i] - distances[i - 1];
    const t = length === 0 ? 0 : (meters - distances[i - 1]) / length;
    const a = path[i - 1];
    const b = path[i];
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
  }
  return path[path.length - 1];
}

/** 兄貴は、自分がルート上で歩いた距離のこの距離（m）先にいる（#51。#59 で 30m から 10m に） */
export const ANIKI_LEAD_M = 10;

/**
 * 兄貴の位置。ルートの上の「歩いた距離 + ANIKI_LEAD_M」の点（全長を超えたら終点）。
 * ルートがない（点が1つ以下）ときは出さない（null）
 */
export function anikiPosition(path: LatLng[], walked: number): LatLng | null {
  if (path.length < 2) return null;
  return pointAlong(path, walked + ANIKI_LEAD_M);
}
