"use client";

import { useCallback, useRef, useState } from "react";
import { requestLoopRoute, type LoopRouteResponse } from "@/lib/route-request";
import type { LatLng } from "@/lib/start-point";

export type LoopRouteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; route: LoopRouteResponse };

/** ルートを作る。失敗したら、同じ条件で再試行できる */
export function useLoopRoute() {
  const [state, setState] = useState<LoopRouteState>({ status: "idle" });
  const lastRequest = useRef<{ start: LatLng; meters: number } | null>(null);
  // 続けて押されたとき、古い返事で上書きしないための番号
  const requestId = useRef(0);

  const generate = useCallback(async (start: LatLng, meters: number) => {
    lastRequest.current = { start, meters };
    const id = ++requestId.current;
    setState({ status: "loading" });
    try {
      const route = await requestLoopRoute(start, meters);
      if (id === requestId.current) setState({ status: "done", route });
    } catch {
      if (id === requestId.current) setState({ status: "error" });
    }
  }, []);

  const retry = useCallback(() => {
    if (lastRequest.current) {
      void generate(lastRequest.current.start, lastRequest.current.meters);
    }
  }, [generate]);

  return { state, generate, retry };
}
