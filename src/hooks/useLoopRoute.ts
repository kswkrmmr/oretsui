"use client";

import { useCallback, useRef, useState } from "react";
import { requestLoopRoute, type LoopRouteResponse } from "@/lib/route-request";
import { initialRotation, nextRotation } from "@/lib/rotation";
import type { LatLng } from "@/lib/start-point";

export type LoopRouteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; route: LoopRouteResponse };

type RouteRequest = { start: LatLng; meters: number; rotation: number };

/**
 * ルートを作る。失敗したら同じ条件で再試行でき、
 * 「別のルート」では回転角をずらして作り直す
 */
export function useLoopRoute() {
  const [state, setState] = useState<LoopRouteState>({ status: "idle" });
  const lastRequest = useRef<RouteRequest | null>(null);
  // 続けて押されたとき、古い返事で上書きしないための番号
  const requestId = useRef(0);

  const run = useCallback(async (request: RouteRequest) => {
    lastRequest.current = request;
    const id = ++requestId.current;
    setState({ status: "loading" });
    try {
      const route = await requestLoopRoute(
        request.start,
        request.meters,
        request.rotation,
      );
      if (id === requestId.current) setState({ status: "done", route });
    } catch {
      if (id === requestId.current) setState({ status: "error" });
    }
  }, []);

  const generate = useCallback(
    (start: LatLng, meters: number) =>
      run({ start, meters, rotation: initialRotation(Math.random()) }),
    [run],
  );

  /** 同じ条件（回転角も同じ）で作り直す */
  const retry = useCallback(() => {
    if (lastRequest.current) void run(lastRequest.current);
  }, [run]);

  /** 同じ出発点・距離で、回転角をずらして違うルートを作る */
  const another = useCallback(() => {
    const last = lastRequest.current;
    if (!last) return;
    void run({
      ...last,
      rotation: nextRotation(last.rotation, Math.random()),
    });
  }, [run]);

  return { state, generate, retry, another };
}
