"use client";

import { useCallback, useEffect, useState } from "react";
import { headingFromEvent, smoothHeading } from "@/lib/heading";

/** 方角が届かなければ、このあと（ms）に「分からない」とみなす */
const WAIT_MS = 3000;

export type HeadingStatus = "waiting" | "ok" | "unavailable";

type OrientationEventClass = {
  requestPermission?: () => Promise<PermissionState>;
};

/**
 * スマホを向けている方角（北が 0°、時計回り）（#69）。active の間だけイベントを受け取る。
 * 許可がない・センサーがない・方角が届かないときは status が "unavailable"
 */
export function useDeviceHeading(active: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<HeadingStatus>("waiting");
  const [permission, setPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");

  /**
   * 方角を使う許可を求める。iPhone はタップの直後でないと求められないので、
   * 「出発」を押したときにその場で呼ぶこと
   */
  const requestPermission = useCallback(async () => {
    const OrientationEvent = (
      window as unknown as { DeviceOrientationEvent?: OrientationEventClass }
    ).DeviceOrientationEvent;
    if (!OrientationEvent) {
      setPermission("denied");
      return;
    }
    // Android など、許可を求めなくてよい環境
    if (typeof OrientationEvent.requestPermission !== "function") {
      setPermission("granted");
      return;
    }
    try {
      const result = await OrientationEvent.requestPermission();
      setPermission(result === "granted" ? "granted" : "denied");
    } catch {
      setPermission("denied");
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setHeading(null);
      setStatus("waiting");
      return;
    }
    if (permission === "denied") {
      setStatus("unavailable");
      return;
    }
    if (permission !== "granted") return;
    const onOrientation = (event: Event) => {
      const value = headingFromEvent(
        event as DeviceOrientationEvent & { webkitCompassHeading?: number },
      );
      if (value === null) return;
      setHeading((previous) => smoothHeading(previous, value));
      setStatus("ok");
    };
    // Android は deviceorientationabsolute、iPhone は deviceorientation で届く
    window.addEventListener("deviceorientationabsolute", onOrientation);
    window.addEventListener("deviceorientation", onOrientation);
    const timer = setTimeout(
      () =>
        setStatus((current) => (current === "ok" ? current : "unavailable")),
      WAIT_MS,
    );
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation);
      window.removeEventListener("deviceorientation", onOrientation);
      clearTimeout(timer);
    };
  }, [active, permission]);

  return { heading, status, requestPermission };
}
