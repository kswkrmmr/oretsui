import type { LatLng } from "@/lib/start-point";
import {
  countOffRoute,
  cumulativeDistances,
  distanceToRoute,
  walkedDistance,
} from "@/lib/walk-progress";

/**
 * 途中で切り上げて帰るときの帰り道（#93）。
 * 帰り道は片道なので、逆回りの判定は使わず、帰り道に沿った進み具合だけを数える
 */
export type ReturnWalk = {
  /** 今いた場所から出発点までの帰り道 */
  path: LatLng[];
  /** 帰り道の長さ（m） */
  total: number;
  /** 帰り道に入るまでに歩いた距離（m）。歩いた距離は、これに帰り道の分を足して通算で出す */
  baseWalked: number;
  /** 帰り道を歩いた距離（m） */
  walked: number;
};

/** 帰り道に入る */
export function startReturnWalk(
  path: LatLng[],
  baseWalked: number,
): ReturnWalk {
  return {
    path,
    total: cumulativeDistances(path).at(-1) ?? 0,
    baseWalked,
    walked: 0,
  };
}

/** 帰り道を歩いているときに位置が届いたら、進み具合と外れの回数を帰り道に対して数える */
export function nextReturnWalk(
  previous: ReturnWalk,
  position: LatLng,
  accuracy: number | undefined,
  offRouteCount: number,
): { walk: ReturnWalk; offRouteCount: number } {
  return {
    walk: {
      ...previous,
      walked: walkedDistance(previous.path, position, previous.walked),
    },
    offRouteCount: countOffRoute(
      offRouteCount,
      distanceToRoute(previous.path, position),
      accuracy,
    ),
  };
}

/**
 * 元のルートの残り（m）が、帰り道（m）より短いか（#96）。
 * 短ければ、すぐには帰り道にせず、このまま進むかどうかを選んでもらう
 */
export function closerAhead(remaining: number, homeward: number): boolean {
  return remaining < homeward;
}
