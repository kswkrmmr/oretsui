"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { useStartPoint } from "@/hooks/useStartPoint";
import { MAP_ID, MAP_OPTIONS } from "@/lib/map-config";
import type { StartPointState } from "@/lib/start-point";

type Props = {
  apiKey: string;
};

/** 画面いっぱいに表示する地図 */
export function MapView({ apiKey }: Props) {
  const { state, tap, longPress, recenter } = useStartPoint();
  const { start } = state;

  // 地図の外からも出発点を確かめられるよう、入れ物に座標を出す（E2E 用）
  const startAttributes = start
    ? {
        "data-start-lat": start.position.lat,
        "data-start-lng": start.position.lng,
        "data-start-source": start.source,
      }
    : {};

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
    >
      {apiKey ? (
        <>
          <APIProvider apiKey={apiKey}>
            <Map
              {...MAP_OPTIONS}
              mapId={MAP_ID}
              className="h-full w-full"
              onClick={onMapEvent(tap)}
              // タッチ端末では長押しで contextmenu が発火する
              onContextmenu={onMapEvent(longPress)}
            >
              <CenterController request={state.centerRequest} />
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
              className="absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+2.5rem)] right-4 left-4 rounded-lg bg-white/90 px-3 py-2 text-center text-sm text-neutral-900 shadow"
            >
              位置情報が使えません。地図をタップして出発点を選んでください
            </p>
          )}
          <button
            type="button"
            aria-label="現在地に戻る"
            onClick={recenter}
            className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-lg active:bg-neutral-100"
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
