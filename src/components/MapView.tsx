"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { ConditionSheet } from "@/components/ConditionSheet";
import { useStartPoint } from "@/hooks/useStartPoint";
import {
  LONG_PRESS_MS,
  movedTooFar,
  pixelToWorldPoint,
  type Point,
} from "@/lib/long-press";
import { MAP_ID, MAP_OPTIONS } from "@/lib/map-config";
import type { LatLng, StartPointState } from "@/lib/start-point";

type Props = {
  apiKey: string;
};

/** 画面いっぱいに表示する地図 */
export function MapView({ apiKey }: Props) {
  const { state, tap, longPress, recenter } = useStartPoint();
  const { start } = state;
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  // 地図の外からも出発点と生成の依頼を確かめられるよう、入れ物に出す（E2E 用）
  const startAttributes = start
    ? {
        "data-start-lat": start.position.lat,
        "data-start-lng": start.position.lng,
        "data-start-source": start.source,
      }
    : {};
  const routeAttributes =
    routeDistance === null ? {} : { "data-route-distance": routeDistance };

  const onMapEvent =
    (handler: typeof tap) =>
    ({ detail }: MapMouseEvent) => {
      if (detail.latLng) handler(detail.latLng);
    };

  return (
    <div
      data-testid="map"
      className="fixed inset-0 h-dvh w-full"
      {...startAttributes}
      {...routeAttributes}
    >
      {apiKey ? (
        <>
          <APIProvider apiKey={apiKey}>
            <Map
              {...MAP_OPTIONS}
              mapId={MAP_ID}
              className="h-full w-full"
              onClick={onMapEvent(tap)}
              // PC の右クリックと Android の長押し用（iOS の長押しは LongPressHandler で受ける）
              onContextmenu={onMapEvent(longPress)}
            >
              <CenterController request={state.centerRequest} />
              <LongPressHandler onLongPress={longPress} />
              {state.current && (
                <AdvancedMarker position={state.current} title="現在地">
                  <div
                    data-testid="current-location-dot"
                    className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow"
                  />
                </AdvancedMarker>
              )}
              {start && (
                <AdvancedMarker position={start.position} title="出発点">
                  <Pin />
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
          {state.showNotice && (
            <p
              role="status"
              className="pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+2.5rem)] right-4 left-4 rounded-lg bg-white/90 px-3 py-2 text-center text-sm text-neutral-900 shadow"
            >
              位置情報が使えません。地図をタップして出発点を選んでください
            </p>
          )}
          {/* 片手で届く画面下部に、条件のシートと、そのすぐ上に「現在地に戻る」を置く */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-end gap-3">
            <button
              type="button"
              aria-label="現在地に戻る"
              onClick={recenter}
              className="pointer-events-auto mr-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-lg active:bg-neutral-100"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
            <div className="pointer-events-auto w-full">
              <ConditionSheet
                disabled={!start}
                // ルートの生成は #6 で実装する。いまは目標距離を受け取るところまで
                onGenerate={setRouteDistance}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-4">
          <p role="alert" className="text-center text-sm">
            Google Maps の API キーが設定されていません
          </p>
        </div>
      )}
    </div>
  );
}

/** 中心を移す依頼が来るたびに、地図の中心を移す（ズームは変えない） */
function CenterController({
  request,
}: {
  request: StartPointState["centerRequest"];
}) {
  const map = useMap();
  useEffect(() => {
    if (map && request) map.panTo(request.position);
  }, [map, request]);
  return null;
}

/**
 * 指での長押しを判定する。iOS は長押しで contextmenu を出さないため、
 * 指が触れてから動かさずに押し続けたかを自前で見る
 */
function LongPressHandler({
  onLongPress,
}: {
  onLongPress: (position: LatLng) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const div = map.getDiv();
    const touching = new Set<number>();
    let start: Point | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cancel = () => {
      clearTimeout(timer);
      start = null;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touching.add(e.pointerId);
      // 2本目の指が触れたらピンチなので取り消す
      if (touching.size > 1) return cancel();
      const pressed = { x: e.clientX, y: e.clientY };
      start = pressed;
      timer = setTimeout(() => {
        start = null;
        const position = pixelToLatLng(map, pressed);
        if (position) onLongPress(position);
      }, LONG_PRESS_MS);
    };
    const move = (e: PointerEvent) => {
      if (start && movedTooFar(start, { x: e.clientX, y: e.clientY })) cancel();
    };
    const up = (e: PointerEvent) => {
      touching.delete(e.pointerId);
      cancel();
    };

    // 地図が中で止めないよう、キャプチャ段階で受ける
    const listeners = [
      ["pointerdown", down],
      ["pointermove", move],
      ["pointerup", up],
      ["pointercancel", up],
    ] as const;
    for (const [type, listener] of listeners)
      div.addEventListener(type, listener, true);
    return () => {
      cancel();
      for (const [type, listener] of listeners)
        div.removeEventListener(type, listener, true);
    };
  }, [map, onLongPress]);
  return null;
}

/** 画面上の位置を、地図上の緯度・経度に変える */
function pixelToLatLng(map: google.maps.Map, client: Point): LatLng | null {
  const projection = map.getProjection();
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (!projection || !center || zoom === undefined) return null;
  const centerWorld = projection.fromLatLngToPoint(center);
  if (!centerWorld) return null;
  const rect = map.getDiv().getBoundingClientRect();
  const world = pixelToWorldPoint(centerWorld, zoom, rect, {
    x: client.x - rect.left,
    y: client.y - rect.top,
  });
  const latLng = projection.fromPointToLatLng(
    new google.maps.Point(world.x, world.y),
  );
  return latLng ? { lat: latLng.lat(), lng: latLng.lng() } : null;
}
