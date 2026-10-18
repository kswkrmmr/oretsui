import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapView } from "./MapView";

// テストで本物の Google Maps を読み込まないよう、ライブラリをモックする
const mocks = vi.hoisted(() => {
  const panTo = vi.fn();
  const fitBounds = vi.fn();
  // 地図の div。幅 400・高さ 800 で画面の左上にあるものとする
  const div = document.createElement("div");
  div.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 800 }) as DOMRect;
  // 計算を追いやすいよう、経度をそのまま x、緯度を反転して y にする投影にする
  const projection = {
    fromLatLngToPoint: (latLng: { lat: () => number; lng: () => number }) => ({
      x: latLng.lng(),
      y: -latLng.lat(),
    }),
    fromPointToLatLng: (point: { x: number; y: number }) => ({
      lat: () => -point.y,
      lng: () => point.x,
    }),
  };
  return {
    mapProps: null as Record<string, unknown> | null,
    panTo,
    fitBounds,
    div,
    // 地図に描いたルートの線（google.maps.Polyline に渡した設定）
    polylines: [] as { path: unknown; setMap: ReturnType<typeof vi.fn> }[],
    // 本物と同じく、同じ地図には同じオブジェクトを返す。中心は北緯30度・東経100度、ズーム0
    map: {
      panTo,
      fitBounds,
      getDiv: () => div,
      getProjection: () => projection,
      getCenter: () => ({ lat: () => 30, lng: () => 100 }),
      getZoom: () => 0,
    },
  };
});
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: ({
    children,
    ...props
  }: { children?: React.ReactNode } & Record<string, unknown>) => {
    mocks.mapProps = props;
    return <div data-testid="google-map">{children}</div>;
  },
  useMap: () => mocks.map,
  AdvancedMarker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Pin: () => <div data-testid="pin" />,
}));

const HERE = { lat: 35.6895, lng: 139.6917 };
const TAPPED = { lat: 35.7, lng: 139.7 };

type Success = (position: GeolocationPosition) => void;
type Failure = (error: GeolocationPositionError) => void;

// navigator.geolocation のモック。呼ばれたコールバックをテストから呼び出す
const geo = {
  getCurrentPosition:
    vi.fn<
      (success: Success, failure: Failure, options?: PositionOptions) => void
    >(),
  lastSuccess: () => geo.getCurrentPosition.mock.lastCall![0],
  lastFailure: () => geo.getCurrentPosition.mock.lastCall![1],
};

function succeed(position = HERE) {
  act(() =>
    geo.lastSuccess()({
      coords: { latitude: position.lat, longitude: position.lng },
    } as GeolocationPosition),
  );
}

function fail(code: 1 | 2 | 3) {
  act(() =>
    geo.lastFailure()({ code, message: "" } as GeolocationPositionError),
  );
}

function mapEvent(name: "onClick" | "onContextmenu", position = TAPPED) {
  const handler = mocks.mapProps![name] as (e: unknown) => void;
  act(() => handler({ detail: { latLng: position, placeId: null } }));
}

const container = () => screen.getByTestId("map");

const fetchMock = vi.fn<typeof fetch>();
// Google のドキュメントにある例。3点のポリライン
const POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function routeResponse(status = 200) {
  return Response.json(
    status === 200
      ? {
          distanceMeters: 2134,
          durationSeconds: 1620,
          encodedPolyline: POLYLINE,
          waypoints: [],
          withinTolerance: true,
        }
      : { error: "ルート検索に失敗しました" },
    { status },
  );
}

async function generateRoute() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "ルートを作る" }));
  });
}
const NOTICE = "位置情報が使えません。地図をタップして出発点を選んでください";

describe("MapView", () => {
  beforeEach(() => {
    mocks.mapProps = null;
    mocks.panTo.mockClear();
    mocks.fitBounds.mockClear();
    mocks.polylines = [];
    // ルート検索 API は、テストごとに返事を決める。決めなければ返事をしない
    fetchMock.mockReset();
    fetchMock.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    geo.getCurrentPosition.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: geo.getCurrentPosition },
    });
    // 本物の Google Maps を読み込まないので、座標の入れ物だけ用意する
    vi.stubGlobal("google", {
      maps: {
        Point: class {
          constructor(
            public x: number,
            public y: number,
          ) {}
        },
        Polyline: class {
          setMap = vi.fn();
          constructor({ path }: { path: unknown }) {
            mocks.polylines.push({ path, setMap: this.setMap });
          }
        },
        LatLngBounds: class {
          points: unknown[] = [];
          extend(point: unknown) {
            this.points.push(point);
          }
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("APIキーが空のとき、エラーメッセージを表示し地図は描画しない", () => {
    render(<MapView apiKey="" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Maps の API キーが設定されていません",
    );
    expect(screen.queryByTestId("google-map")).not.toBeInTheDocument();
    expect(mocks.mapProps).toBeNull();
  });

  it("地図に東京駅・ズーム15・1本指操作・標準ボタン非表示・Map ID の設定を渡す", () => {
    render(<MapView apiKey="test-key" />);
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
    expect(mocks.mapProps).toMatchObject({
      defaultCenter: { lat: 35.681236, lng: 139.767125 },
      defaultZoom: 15,
      gestureHandling: "greedy",
      disableDefaultUI: true,
      mapId: "DEMO_MAP_ID",
    });
  });

  it("開いたらすぐ、指定の設定で現在地を1回取得する", () => {
    render(<MapView apiKey="test-key" />);
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(geo.getCurrentPosition.mock.lastCall![2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });

  it("出発点が決まるまで、data-start-* 属性を出さない", () => {
    render(<MapView apiKey="test-key" />);
    expect(container()).not.toHaveAttribute("data-start-lat");
    expect(container()).not.toHaveAttribute("data-start-lng");
    expect(container()).not.toHaveAttribute("data-start-source");
  });

  it("現在地が取れたら、出発点が現在地になり、地図の中心が移る", () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    expect(container()).toHaveAttribute("data-start-lat", String(HERE.lat));
    expect(container()).toHaveAttribute("data-start-lng", String(HERE.lng));
    expect(container()).toHaveAttribute("data-start-source", "current");
    expect(mocks.panTo).toHaveBeenCalledWith(HERE);
    // 現在地の青い丸と、出発点のピン
    expect(screen.getByTestId("current-location-dot")).toBeInTheDocument();
    expect(screen.getByTestId("pin")).toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it.each([
    ["拒否", 1],
    ["タイムアウト", 3],
  ] as const)("%sのとき、案内が表示される", (_, code) => {
    render(<MapView apiKey="test-key" />);
    fail(code);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("位置情報に非対応のとき、案内が表示される", () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    render(<MapView apiKey="test-key" />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it("位置情報が使えないとき、地図をタップした場所が出発点になり、案内が消える", () => {
    render(<MapView apiKey="test-key" />);
    fail(1);
    mapEvent("onClick");
    expect(container()).toHaveAttribute("data-start-lat", String(TAPPED.lat));
    expect(container()).toHaveAttribute("data-start-lng", String(TAPPED.lng));
    expect(container()).toHaveAttribute("data-start-source", "manual");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("現在地が取れていても、長押しした場所が出発点になる", () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    mapEvent("onContextmenu");
    expect(container()).toHaveAttribute("data-start-lat", String(TAPPED.lat));
    expect(container()).toHaveAttribute("data-start-lng", String(TAPPED.lng));
    expect(container()).toHaveAttribute("data-start-source", "manual");
  });

  it("現在地が取れているとき、通常のタップでは出発点が変わらない", () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    mapEvent("onClick");
    expect(container()).toHaveAttribute("data-start-lat", String(HERE.lat));
    expect(container()).toHaveAttribute("data-start-source", "current");
  });

  it("「現在地に戻る」を押すと、現在地があれば中心が移る", () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    mapEvent("onContextmenu");
    mocks.panTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "現在地に戻る" }));
    expect(mocks.panTo).toHaveBeenCalledWith(HERE);
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("「現在地に戻る」を押すと、現在地がなければ取得をやり直す", () => {
    render(<MapView apiKey="test-key" />);
    fail(3);
    fireEvent.click(screen.getByRole("button", { name: "現在地に戻る" }));
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(2);
    succeed();
    expect(mocks.panTo).toHaveBeenCalledWith(HERE);
    expect(container()).toHaveAttribute("data-start-source", "current");
  });

  it("出発点がないうちは「ルートを作る」を押せない", () => {
    render(<MapView apiKey="test-key" />);
    fail(1);
    expect(screen.getByRole("button", { name: "ルートを作る" })).toBeDisabled();
  });

  it("「ルートを作る」を押すと、目標距離を data-route-distance に出す", () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    expect(container()).not.toHaveAttribute("data-route-distance");
    fireEvent.click(screen.getByRole("button", { name: "ルートを作る" }));
    expect(container()).toHaveAttribute("data-route-distance", "2400");
  });

  it("ルートを作ると、出発点と目標距離で API を呼び、線を描いて全体が収まるようにズームする", async () => {
    fetchMock.mockResolvedValue(routeResponse());
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();

    const [url, init] = fetchMock.mock.lastCall!;
    expect(url).toBe("/api/route");
    expect(JSON.parse(init!.body as string)).toEqual({
      start: HERE,
      meters: 2400,
    });
    expect(mocks.polylines).toHaveLength(1);
    expect(mocks.polylines[0].path).toHaveLength(3);
    expect(mocks.fitBounds).toHaveBeenCalledTimes(1);
    expect(mocks.fitBounds.mock.lastCall![0].points).toHaveLength(3);
    expect(screen.getByTestId("route-summary")).toHaveTextContent(
      "ルート 2.1 km・約27分",
    );
  });

  it("作り直すと、前のルートの線を消す", async () => {
    fetchMock.mockImplementation(async () => routeResponse());
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    await generateRoute();
    expect(mocks.polylines[0].setMap).toHaveBeenCalledWith(null);
  });

  it("生成に失敗するとエラーと再試行ボタンを出し、再試行で同じ条件で作り直す", async () => {
    fetchMock.mockResolvedValueOnce(routeResponse(502));
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ルートを作れませんでした",
    );
    expect(mocks.polylines).toHaveLength(0);

    fetchMock.mockResolvedValueOnce(routeResponse());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]!.body).toBe(
      fetchMock.mock.calls[0][1]!.body,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-summary")).toBeInTheDocument();
  });

  it("作成中は「ルートを作る」を押せない", async () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    expect(
      screen.getByRole("button", { name: "ルートを作成中…" }),
    ).toBeDisabled();
  });

  // iOS は長押しで contextmenu を出さないため、指の押し続けを自前で判定する
  describe("指での長押し", () => {
    // 地図の (250, 380) は、中心 (200, 400) から右に50・上に20。ズーム0なので北緯50度・東経150度
    const PRESS = { clientX: 250, clientY: 380 };
    const touch = (pointerId = 1) => ({ pointerType: "touch", pointerId });

    beforeEach(() => {
      vi.useFakeTimers();
      render(<MapView apiKey="test-key" />);
      succeed();
    });

    const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    it("500ms 押し続けると、その場所が出発点になる", () => {
      fireEvent.pointerDown(mocks.div, { ...touch(), ...PRESS });
      wait(499);
      expect(container()).toHaveAttribute("data-start-source", "current");
      wait(1);
      expect(container()).toHaveAttribute("data-start-lat", "50");
      expect(container()).toHaveAttribute("data-start-lng", "150");
      expect(container()).toHaveAttribute("data-start-source", "manual");
    });

    it("500ms より前に指を離すと、出発点は変わらない", () => {
      fireEvent.pointerDown(mocks.div, { ...touch(), ...PRESS });
      wait(300);
      fireEvent.pointerUp(mocks.div, { ...touch(), ...PRESS });
      wait(500);
      expect(container()).toHaveAttribute("data-start-source", "current");
    });

    it("押したまま 10px 以上動かす（ドラッグ）と、出発点は変わらない", () => {
      fireEvent.pointerDown(mocks.div, { ...touch(), ...PRESS });
      fireEvent.pointerMove(mocks.div, {
        ...touch(),
        clientX: 250,
        clientY: 390,
      });
      wait(500);
      expect(container()).toHaveAttribute("data-start-source", "current");
    });

    it("2本目の指が触れる（ピンチ）と、出発点は変わらない", () => {
      fireEvent.pointerDown(mocks.div, { ...touch(1), ...PRESS });
      fireEvent.pointerDown(mocks.div, {
        ...touch(2),
        clientX: 100,
        clientY: 100,
      });
      wait(500);
      expect(container()).toHaveAttribute("data-start-source", "current");
    });

    it("マウスの押し続けには反応しない（PC は右クリックで指定する）", () => {
      fireEvent.pointerDown(mocks.div, {
        pointerType: "mouse",
        pointerId: 1,
        ...PRESS,
      });
      wait(500);
      expect(container()).toHaveAttribute("data-start-source", "current");
    });
  });
});
