/** 東京駅。現在地を取得できるまでの初期表示位置 */
export const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 } as const;

/** 地図の初期設定 */
export const MAP_OPTIONS = {
  defaultCenter: TOKYO_STATION,
  defaultZoom: 15,
  // 1本指で地図を動かす（全画面の地図なのでページのスクロールと競合しない）
  gestureHandling: "greedy",
  // Google マップ標準のボタンはすべて隠す
  disableDefaultUI: true,
} as const;

/** AdvancedMarker に必要な Map ID。未設定なら Google が用意している開発用の ID を使う */
export const MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
