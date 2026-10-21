import type { LatLng } from "@/lib/start-point";
import { walkedDistance } from "@/lib/walk-progress";

/**
 * 逆回りの歩いた距離が、順回りよりこの距離（m）以上多くなったら逆回りに切り替える（#60）。
 * 最初の道を行きと帰りで共有するルートでは、共有している間はどちらも同じだけ増えるので差が開かない。
 * 分かれ道から逆回りの道を進むと、逆回りだけが増えて差が開く
 */
export const REVERSE_LEAD_M = 30;
/** 向きを判定するのは、どちらかの歩いた距離がこの距離（m）に達するまで。その後は向きを固定する */
export const DECIDE_WITHIN_M = 300;

/**
 * 散歩の向き（#52）。周回ルートはどちら回りでも同じ道なので、
 * 歩き出しの向きを見て、逆向きなら逆回り（点の並びを逆にしたルート）として扱う
 */
export type WalkDirection = {
  /** 逆回りとして扱っているか */
  reversed: boolean;
  /** 向きが決まった（もう切り替えない）か */
  decided: boolean;
  /** 順回り・逆回りそれぞれで歩いた距離（m） */
  forward: number;
  reverse: number;
  /** 今の向きで歩いた距離（m） */
  walked: number;
};

export function initialWalkDirection(): WalkDirection {
  return { reversed: false, decided: false, forward: 0, reverse: 0, walked: 0 };
}

/** ルートの点の並びを逆にしたもの（逆回りのルート） */
export function reversePath(path: LatLng[]): LatLng[] {
  return [...path].reverse();
}

/**
 * 位置が届くたびに、両方の向きで歩いた距離を求め、逆回りに切り替えるか決める。
 * switched は、この位置で逆回りに切り替わったときだけ true
 */
export function nextWalkDirection(
  previous: WalkDirection,
  path: LatLng[],
  position: LatLng,
): { state: WalkDirection; switched: boolean } {
  const forward = walkedDistance(path, position, previous.forward);
  const reverse = walkedDistance(reversePath(path), position, previous.reverse);
  let { reversed, decided } = previous;
  let switched = false;
  if (!decided) {
    if (Math.max(forward, reverse) >= DECIDE_WITHIN_M) {
      // 判定は最初の 300m だけ。GPS が大きく飛んで一気に超えたときも、切り替えずに固定する
      decided = true;
    } else if (reverse >= forward + REVERSE_LEAD_M) {
      // 切り替えは1回だけ。逆回りから順回りへは戻らない
      reversed = true;
      decided = true;
      switched = true;
    }
  }
  return {
    state: {
      reversed,
      decided,
      forward,
      reverse,
      walked: reversed ? reverse : forward,
    },
    switched,
  };
}
