"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  homewardWalkTalk,
  nextWalkTalk,
  reversedWalkTalk,
  startWalkTalk,
  type WalkTalk,
} from "@/lib/aniki";
import {
  nextReturnWalk,
  startReturnWalk,
  type ReturnWalk,
} from "@/lib/return-walk";
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
      /** 出発してから位置の更新を受け取った回数（#66。E2E で更新が届いたことを確かめるため） */
      updates: number;
      /** 途中で切り上げて帰っているときの帰り道（#93）。帰っていなければ null */
      homeward: ReturnWalk | null;
    }
  | { status: "unavailable" };

/** 終えた散歩の記録（#68） */
export type WalkRecord = { seconds: number; meters: number };

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

  // 出発した時刻（#68）。位置が取れなくなっても時間は計り続ける
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // 最後に分かった歩いた距離。位置が取れなくなったあとに終了しても、まとめに使う
  const lastWalked = useRef(0);
  useEffect(() => {
    if (state.status === "walking") lastWalked.current = state.walked;
  }, [state]);

  /** 散歩を終える。出発していれば、今回の散歩の経過時間（秒）と歩いた距離（m）を返す */
  const stop = useCallback((): WalkRecord | null => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setState({ status: "idle" });
    setStartedAt(null);
    if (startedAt === null) return null;
    return {
      seconds: (Date.now() - startedAt) / 1000,
      meters: lastWalked.current,
    };
  }, [startedAt]);

  const start = useCallback(() => {
    setStartedAt(Date.now());
    lastWalked.current = 0;
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
      updates: 0,
      homeward: null,
    });
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude };
        setState((previous) => {
          if (previous.status !== "walking") return previous;
          // 帰り道では、進み具合・外れ・兄貴の一言を帰り道に対して数える。歩いた距離は通算（#93）
          if (previous.homeward) {
            const { walk: homeward, offRouteCount } = nextReturnWalk(
              previous.homeward,
              position,
              coords.accuracy,
              previous.offRouteCount,
            );
            return {
              ...previous,
              position,
              walked: homeward.baseWalked + homeward.walked,
              offRouteCount,
              talk: nextWalkTalk(previous.talk, {
                walked: homeward.walked,
                total: homeward.total,
                offRouteCount,
              }),
              updates: previous.updates + 1,
              homeward,
            };
          }
          const { state: direction, switched } = nextWalkDirection(
            previous.direction,
            path,
            position,
          );
          const walked = direction.walked;
          const offRouteCount = countOffRoute(
            previous.offRouteCount,
            distanceToRoute(path, position),
            // GPS の精度に合わせて外れの基準を変える（#53）
            coords.accuracy,
          );
          return {
            status: "walking",
            position,
            walked,
            offRouteCount,
            // 逆回りに切り替えたときは、兄貴がそのことを言う
            talk: switched
              ? reversedWalkTalk(previous.talk, walked)
              : nextWalkTalk(previous.talk, {
                  walked,
                  total: length,
                  offRouteCount,
                }),
            direction,
            updates: previous.updates + 1,
            homeward: null,
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

  /** 途中で切り上げて、帰り道を歩き始める（#93） */
  const goHome = useCallback((homePath: LatLng[]) => {
    setState((previous) =>
      previous.status === "walking"
        ? {
            ...previous,
            offRouteCount: 0,
            talk: homewardWalkTalk(previous.talk),
            homeward: startReturnWalk(homePath, previous.walked),
          }
        : previous,
    );
  }, []);

  // 画面を離れるときは追いかけるのをやめる
  useEffect(
    () => () => {
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  // 今歩いているルート。逆回りなら点の並びを逆にしたもの、帰っているなら帰り道（兄貴の位置などに使う）
  const homeward = state.status === "walking" ? state.homeward : null;
  const reversed =
    state.status === "walking" && !homeward && state.direction.reversed;
  const forwardPath = useMemo(
    () => (reversed ? reversePath(path) : path),
    [path, reversed],
  );
  const activePath = homeward?.path ?? forwardPath;
  // 今歩いているルートの上で歩いた距離（帰り道なら帰り道の分だけ）
  const activeWalked =
    state.status !== "walking" ? 0 : (homeward?.walked ?? state.walked);

  return {
    state,
    // 帰っているときは帰り道の長さ
    total: homeward?.total ?? total,
    start,
    stop,
    goHome,
    reversed,
    activePath,
    activeWalked,
    startedAt,
  };
}
