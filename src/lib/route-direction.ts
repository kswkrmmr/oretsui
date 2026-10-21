import type { LatLng } from "@/lib/start-point";
import { cumulativeDistances } from "@/lib/walk-progress";

/** 最初の方角を決めるとき、出発点からルートに沿ってこの距離（m）進んだ点を見る */
export const FIRST_DIRECTION_M = 50;

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

const COMPASS = [
  "北",
  "北東",
  "東",
  "南東",
  "南",
  "南西",
  "西",
  "北西",
] as const;
export type Compass = (typeof COMPASS)[number];

/** from から to への向きを8方位の名前にする（北を 0° として時計回り、45° ごと） */
export function compassName(from: LatLng, to: LatLng): Compass {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRadians(to.lat));
  const x =
    Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat)) -
    Math.sin(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(bearing / 45) % 8];
}

/**
 * 歩き始めの方角。出発点からルートに沿って FIRST_DIRECTION_M 進んだ点への向き。
 * ルートがそれより短ければ終点への向き。点が1つ以下なら分からない（null）
 */
export function firstDirection(path: LatLng[]): Compass | null {
  if (path.length < 2) return null;
  return compassName(path[0], pointAlong(path, FIRST_DIRECTION_M));
}

/** 兄貴は、自分がルート上で歩いた距離のこの距離（m）先にいる（#51） */
export const ANIKI_LEAD_M = 30;

/**
 * 兄貴の位置。ルートの上の「歩いた距離 + ANIKI_LEAD_M」の点（全長を超えたら終点）。
 * ルートがない（点が1つ以下）ときは出さない（null）
 */
export function anikiPosition(path: LatLng[], walked: number): LatLng | null {
  if (path.length < 2) return null;
  return pointAlong(path, walked + ANIKI_LEAD_M);
}
