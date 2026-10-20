"use client";

import { useEffect } from "react";

/**
 * active の間、画面がスリープしないようにする（Wake Lock API が使える場合だけ）。
 * 画面を離れると自動で解放されるので、戻ってきたら取り直す
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (released) await lock.release();
        else sentinel = lock;
      } catch {
        // 省電力モードなどで断られても、散歩はそのまま続ける
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
