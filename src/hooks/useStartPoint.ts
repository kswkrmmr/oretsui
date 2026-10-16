"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  GEOLOCATION_OPTIONS,
  initialStartPointState,
  startPointReducer,
  type LatLng,
} from "@/lib/start-point";

/** 現在地を取得して出発点を決める。地図のタップ・長押しで出発点を変えられる */
export function useStartPoint() {
  const [state, dispatch] = useReducer(
    startPointReducer,
    initialStartPointState,
  );

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      dispatch({ type: "locationFailed" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        dispatch({
          type: "located",
          position: { lat: coords.latitude, lng: coords.longitude },
        }),
      // 拒否・タイムアウト・取得不能のどれでも同じ扱い
      () => dispatch({ type: "locationFailed" }),
      GEOLOCATION_OPTIONS,
    );
  }, []);

  // 開いたらすぐ1回だけ取得する（追従は #9）
  useEffect(() => {
    locate();
  }, [locate]);

  const tap = useCallback(
    (position: LatLng) => dispatch({ type: "mapTap", position }),
    [],
  );
  const longPress = useCallback(
    (position: LatLng) => dispatch({ type: "mapLongPress", position }),
    [],
  );

  const hasCurrent = state.current !== null;
  /** 現在地があれば中心を移し、なければ取得をやり直す */
  const recenter = useCallback(() => {
    if (hasCurrent) dispatch({ type: "recenter" });
    else locate();
  }, [hasCurrent, locate]);

  return { state, tap, longPress, recenter };
}
