import { walkingSeconds, type WalkSpeed } from "@/lib/walk-conditions";

/** 体重として受け付ける範囲（kg）（#89） */
export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 200;

/** 歩く速さごとの運動の強さ（METs）（#89） */
export const WALK_METS: Record<WalkSpeed, number> = {
  slow: 3.0,
  normal: 3.5,
  fast: 4.3,
};

/** 入力された体重を kg にする。整数で範囲内のときだけ。それ以外は未入力（null） */
export function parseWeight(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const weight = Number(trimmed);
  return weight >= MIN_WEIGHT_KG && weight <= MAX_WEIGHT_KG ? weight : null;
}

/**
 * 消費カロリー（kcal、整数）＝ METs × 体重（kg）× 時間（h）× 1.05（#89）。
 * 時間は「歩いた距離 ÷ 歩く速さ」で出す（止まっている間は増えないように）。
 * 体重が未入力なら null
 */
export function walkingCalories(
  weightKg: number | null,
  meters: number,
  speed: WalkSpeed,
): number | null {
  if (weightKg === null) return null;
  const hours = walkingSeconds(meters, speed) / 3600;
  return Math.round(WALK_METS[speed] * weightKg * hours * 1.05);
}
