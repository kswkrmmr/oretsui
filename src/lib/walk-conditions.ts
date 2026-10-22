/** 歩く速さ（1分あたりの距離 m） */
export const WALK_SPEEDS = {
  slow: { label: "ゆっくり", metersPerMinute: 60 },
  // 不動産広告の徒歩分数と同じ基準
  normal: { label: "ふつう", metersPerMinute: 80 },
  fast: { label: "早歩き", metersPerMinute: 100 },
} as const;

export type WalkSpeed = keyof typeof WALK_SPEEDS;

/** 時間のプリセット（分） */
export const TIME_PRESETS = [15, 30, 60] as const;

/** 距離のプリセット（m） */
export const DISTANCE_PRESETS = [1000, 2000, 3000, 5000] as const;

/** 散歩の条件。モードを切り替えても、それぞれの選択は残す */
export type WalkConditions = {
  mode: "time" | "distance";
  minutes: number;
  speed: WalkSpeed;
  meters: number;
};

export const INITIAL_CONDITIONS: WalkConditions = {
  mode: "time",
  minutes: 30,
  speed: "normal",
  meters: 2000,
};

/** 時間と歩く速さから距離（m）を求める */
export function minutesToMeters(minutes: number, speed: WalkSpeed): number {
  return minutes * WALK_SPEEDS[speed].metersPerMinute;
}

/** 条件から、ルートの目標距離（m）を求める */
export function targetMeters(conditions: WalkConditions): number {
  return conditions.mode === "time"
    ? minutesToMeters(conditions.minutes, conditions.speed)
    : conditions.meters;
}

/**
 * ルートの所要時間を計算するときの歩く速さ（#72）。
 * 時間で選んだときは選んだ速さ、距離で選んだとき（速さを選ばない）は「ふつう」
 */
export function durationSpeed(conditions: WalkConditions): WalkSpeed {
  return conditions.mode === "time" ? conditions.speed : "normal";
}

/** 距離（m）を歩く速さで歩いたときの所要時間（秒）（#72） */
export function walkingSeconds(meters: number, speed: WalkSpeed): number {
  return (meters / WALK_SPEEDS[speed].metersPerMinute) * 60;
}

/** 距離を「約2.4km」のように 0.1km 単位で表示する */
export function formatDistance(meters: number): string {
  return `約${(meters / 1000).toFixed(1)}km`;
}
