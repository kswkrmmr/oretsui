"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nextWalkTalk, startWalkTalk, type WalkTalk } from "@/lib/aniki";
import type { LatLng } from "@/lib/start-point";
import {
  countOffRoute,
  cumulativeDistances,
  distanceToRoute,
  walkedDistance,
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
    });
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude };
        setState((previous) => {
          if (previous.status !== "walking") return previous;
          const walked = walkedDistance(path, position, previous.walked);
          const offRouteCount = countOffRoute(
            previous.offRouteCount,
            distanceToRoute(path, position),
          );
          return {
            status: "walking",
            position,
            walked,
            offRouteCount,
            talk: nextWalkTalk(previous.talk, {
              walked,
              total: length,
              offRouteCount,
            }),
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

  return { state, total, start, stop };
}
