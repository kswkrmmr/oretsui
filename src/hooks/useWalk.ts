"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nextWalkTalk, startWalkTalk, type WalkTalk } from "@/lib/aniki";
import type { LatLng } from "@/lib/start-point";
import {
  initialWalkDirection,
  nextWalkDirection,
  reversePath,
  type WalkDirection,
} from "@/lib/walk-direction";
import {
  countOffRoute,
  cumulativeDistances,
  distanceToRoute,
} from "@/lib/walk-progress";

export type WalkState =
  | { status: "idle" }
  | {
      status: "walking";
      position: LatLng | null;
      walked: number;
      /** ルートから外れた位置が続けて届いた回数（#36） */
      offRouteCount: number;
      /** 兄貴の一言（#42） */
      talk: WalkTalk;
      /** 歩いている向き。逆向きに歩き出したら逆回りとして扱う（#52） */
      direction: WalkDirection;
    }
  | { status: "unavailable" };

/** 散歩中に現在地を追いかけるときの設定。古い位置は使わない */
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

/** 散歩中モード。「出発」で現在地を追いかけ、ルート上の進み具合を出す */
export function useWalk(path: LatLng[]) {
  const [state, setState] = useState<WalkState>({ status: "idle" });
  const watchId = useRef<number | null>(null);
  const total = cumulativeDistances(path).at(-1) ?? 0;

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setState({ status: "idle" });
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }
    const length = cumulativeDistances(path).at(-1) ?? 0;
    setState({
      status: "walking",
      position: null,
      walked: 0,
      offRouteCount: 0,
      talk: startWalkTalk(),
      direction: initialWalkDirection(),
    });
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude };
        setState((previous) => {
          if (previous.status !== "walking") return previous;
          const { state: direction, switched } = nextWalkDirection(
            previous.direction,
            path,
            position,
          );
          const walked = direction.walked;
          const offRouteCount = countOffRoute(
            previous.offRouteCount,
            distanceToRoute(path, position),
          );
          return {
            status: "walking",
            position,
            walked,
            offRouteCount,
            // 逆回りに切り替えたときは、兄貴がそのことを言う
            talk: switched
              ? { ...previous.talk, scene: "reversed" }
              : nextWalkTalk(previous.talk, {
                  walked,
                  total: length,
                  offRouteCount,
                }),
            direction,
          };
        });
      },
      // 許可がないときだけ止める。タイムアウトや一時的な取得不能は、次の位置を待つ
      (error) => {
        if (error.code === error.PERMISSION_DENIED)
          setState({ status: "unavailable" });
      },
      WATCH_OPTIONS,
    );
  }, [path]);

  // 画面を離れるときは追いかけるのをやめる
  useEffect(
    () => () => {
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  // 今の向きで歩くルート。逆回りなら点の並びを逆にしたもの（兄貴の位置などに使う）
  const reversed = state.status === "walking" && state.direction.reversed;
  const activePath = useMemo(
    () => (reversed ? reversePath(path) : path),
    [path, reversed],
  );

  return { state, total, start, stop, reversed, activePath };
}
