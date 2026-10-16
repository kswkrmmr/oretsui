/** 緯度・経度 */
export type LatLng = { lat: number; lng: number };

/** 出発点。source は現在地（current）か、タップ・長押しで指定（manual）か */
export type StartPoint = {
  position: LatLng;
  source: "current" | "manual";
};

export type StartPointState = {
  /** 取得できた現在地 */
  current: LatLng | null;
  /** 位置情報の状態（取得中・使える・使えない） */
  locationStatus: "locating" | "available" | "unavailable";
  start: StartPoint | null;
  /** 「位置情報が使えません」の案内を出すか */
  showNotice: boolean;
  /** 地図の中心を移す依頼。id が変わるたびに中心を移す */
  centerRequest: { position: LatLng; id: number } | null;
};

export type StartPointAction =
  | { type: "located"; position: LatLng }
  | { type: "locationFailed" }
  | { type: "mapTap"; position: LatLng }
  | { type: "mapLongPress"; position: LatLng }
  | { type: "recenter" };

export const initialStartPointState: StartPointState = {
  current: null,
  locationStatus: "locating",
  start: null,
  showNotice: false,
  centerRequest: null,
};

/** 現在地を1回取得するときの設定 */
export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

function requestCenter(state: StartPointState, position: LatLng) {
  return { position, id: (state.centerRequest?.id ?? 0) + 1 };
}

/** 現在地の取得結果と地図の操作から、出発点を決める */
export function startPointReducer(
  state: StartPointState,
  action: StartPointAction,
): StartPointState {
  switch (action.type) {
    case "located":
      return {
        ...state,
        current: action.position,
        locationStatus: "available",
        start: { position: action.position, source: "current" },
        showNotice: false,
        centerRequest: requestCenter(state, action.position),
      };
    case "locationFailed":
      return { ...state, locationStatus: "unavailable", showNotice: true };
    case "mapTap":
      // 位置情報が使えるときの通常のタップは、地図を動かすつもりの誤操作を防ぐため無視する
      if (state.locationStatus !== "unavailable") return state;
      return {
        ...state,
        start: { position: action.position, source: "manual" },
        showNotice: false,
      };
    case "mapLongPress":
      return {
        ...state,
        start: { position: action.position, source: "manual" },
        showNotice: false,
      };
    case "recenter":
      if (!state.current) return state;
      return { ...state, centerRequest: requestCenter(state, state.current) };
  }
}
