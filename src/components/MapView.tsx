"use client";

import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { MAP_OPTIONS } from "@/lib/map-config";

type Props = {
  apiKey: string;
};

/** 画面いっぱいに表示する地図 */
export function MapView({ apiKey }: Props) {
  return (
    <div data-testid="map" className="fixed inset-0 h-dvh w-full">
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <Map {...MAP_OPTIONS} className="h-full w-full" />
        </APIProvider>
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
