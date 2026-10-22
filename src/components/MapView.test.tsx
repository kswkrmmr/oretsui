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
    polylines: [] as {
      path: unknown;
      icons?: unknown;
      setMap: ReturnType<typeof vi.fn>;
      setOptions?: ReturnType<typeof vi.fn>;
    }[],
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
  // 散歩中モード（#9）で現在地を追いかける
  watchPosition:
    vi.fn<
      (success: Success, failure: Failure, options?: PositionOptions) => number
    >(),
  clearWatch: vi.fn<(id: number) => void>(),
};

/** 散歩中、現在地が動いたことにする */
function move(position: { lat: number; lng: number }, accuracy?: number) {
  act(() =>
    geo.watchPosition.mock.lastCall![0]({
      coords: { latitude: position.lat, longitude: position.lng, accuracy },
    } as GeolocationPosition),
  );
}

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

// 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
const LOOP_POLYLINE = "kryxEcprsY_X??g^~Wf^";

function routeResponse(status = 200, encodedPolyline = POLYLINE) {
  return Response.json(
    status === 200
      ? {
          distanceMeters: 2134,
          durationSeconds: 1620,
          encodedPolyline,
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
    geo.watchPosition.mockReset().mockReturnValue(7);
    geo.clearWatch.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: geo.getCurrentPosition,
        watchPosition: geo.watchPosition,
        clearWatch: geo.clearWatch,
      },
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
          setOptions = vi.fn();
          constructor({ path, icons }: { path: unknown; icons?: unknown }) {
            mocks.polylines.push({
              path,
              icons,
              setMap: this.setMap,
              setOptions: this.setOptions,
            });
          }
        },
        SymbolPath: { FORWARD_CLOSED_ARROW: 1, BACKWARD_CLOSED_ARROW: 2 },
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
    vi.restoreAllMocks();
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
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    fetchMock.mockResolvedValue(routeResponse());
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();

    const [url, init] = fetchMock.mock.lastCall!;
    expect(url).toBe("/api/route");
    // Math.random を 0.5 に固定しているので、回転角は 180°
    expect(JSON.parse(init!.body as string)).toEqual({
      start: HERE,
      meters: 2400,
      rotation: 180,
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
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "別のルート" }));
    });
    expect(mocks.polylines[0].setMap).toHaveBeenCalledWith(null);
  });

  it("ルートの線に、進む向きの矢印を一定間隔で並べる（#50）", async () => {
    fetchMock.mockResolvedValue(routeResponse());
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    expect(mocks.polylines[0].icons).toEqual([
      {
        icon: expect.objectContaining({
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 3,
          fillColor: "#ffffff",
          fillOpacity: 1,
        }),
        repeat: "80px",
      },
    ]);
  });

  it("ルートができると、兄貴は方角を言わずに「俺についてこい」と言う（#59）", async () => {
    // 出発点から北へ進んでから東へ曲がり、出発点へ戻る三角形
    fetchMock.mockResolvedValue(routeResponse(200, LOOP_POLYLINE));
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    expect(screen.getByTestId("aniki-line")).toHaveTextContent(
      "いい道を見つけたぞ。俺についてこい！",
    );
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

  it("「別のルート」を押すと、同じ条件で回転角を 90〜270° ずらして作り直す", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    fetchMock.mockImplementation(async () => routeResponse());
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "別のルート" }));
    });

    const [first, second] = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(init!.body as string),
    );
    // 乱数 0 なので、1回目は 0°、2回目は 0° から 90° ずらす
    expect(first).toEqual({ start: HERE, meters: 2400, rotation: 0 });
    expect(second).toEqual({ start: HERE, meters: 2400, rotation: 90 });
    expect(screen.getByTestId("route-summary")).toBeInTheDocument();
  });

  it("再試行は、失敗したときと同じ回転角で作り直す", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.25).mockReturnValue(0.75);
    fetchMock.mockResolvedValueOnce(routeResponse(502));
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    fetchMock.mockResolvedValueOnce(routeResponse());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    });
    const rotations = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init!.body as string).rotation,
    );
    expect(rotations).toEqual([90, 90]);
  });

  it("作成中は条件とボタンを隠し、「ルートを作成中…」だけを出す", async () => {
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    expect(screen.getByRole("status")).toHaveTextContent("ルートを作成中…");
    expect(screen.queryByRole("button", { name: "ルートを作る" })).toBeNull();
    expect(screen.queryByRole("button", { name: "別のルート" })).toBeNull();
  });

  it("ルートを作ったら条件を隠し、「条件を変える」で選んでいた条件に戻る", async () => {
    fetchMock.mockImplementation(async () => routeResponse());
    render(<MapView apiKey="test-key" />);
    succeed();
    fireEvent.click(screen.getByRole("button", { name: "60分" }));
    await generateRoute();

    expect(screen.queryByRole("button", { name: "ルートを作る" })).toBeNull();
    expect(screen.queryByRole("button", { name: "60分" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "別のルート" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "条件を変える" }));
    expect(screen.getByRole("button", { name: "60分" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "ルートを作る" })).toBeEnabled();
    // 条件を選び直しているあいだは、前のルートの距離だけを出す
    expect(screen.getByTestId("route-summary")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "別のルート" })).toBeNull();
    expect(mocks.polylines[0].setMap).not.toHaveBeenCalled();
  });

  it("生成に失敗したときは、条件も見えるままにする", async () => {
    fetchMock.mockResolvedValueOnce(routeResponse(502));
    render(<MapView apiKey="test-key" />);
    succeed();
    await generateRoute();
    expect(screen.getByRole("button", { name: "ルートを作る" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
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
  describe("散歩中モード", () => {
    async function startWalk() {
      fetchMock.mockImplementation(async () =>
        routeResponse(200, LOOP_POLYLINE),
      );
      render(<MapView apiKey="test-key" />);
      succeed();
      await generateRoute();
      fireEvent.click(screen.getByRole("button", { name: "出発" }));
    }

    describe("位置の更新を受け取った回数（#66、E2E 用）", () => {
      it("散歩中、位置の更新を受け取るたびに data-walk-updates が 0 → 1 → 2 と増える", async () => {
        await startWalk();
        expect(container()).toHaveAttribute("data-walk-updates", "0");
        move(HERE);
        expect(container()).toHaveAttribute("data-walk-updates", "1");
        // 同じ位置が届いても数える（更新を受け取ったことを確かめるため）
        move(HERE);
        expect(container()).toHaveAttribute("data-walk-updates", "2");
      });

      it("散歩中でないときは data-walk-updates を出さない", async () => {
        fetchMock.mockImplementation(async () =>
          routeResponse(200, LOOP_POLYLINE),
        );
        render(<MapView apiKey="test-key" />);
        succeed();
        await generateRoute();
        expect(container()).not.toHaveAttribute("data-walk-updates");
        fireEvent.click(screen.getByRole("button", { name: "出発" }));
        expect(container()).toHaveAttribute("data-walk-updates", "0");
        fireEvent.click(screen.getByRole("button", { name: "終了" }));
        expect(container()).not.toHaveAttribute("data-walk-updates");
      });
    });

    describe("逆回りに歩いても動く（#52）", () => {
      // 出発点（HERE）から北へ約300m → 東 → 南 → 西へ戻る正方形。逆回りは東へ歩き出す
      const SQUARE = "kryxEcprsY{O??sSzO??rS";
      const east = (m: number) => ({
        lat: HERE.lat,
        lng: HERE.lng + m / 90_300,
      });

      async function startSquareWalk() {
        fetchMock.mockImplementation(async () => routeResponse(200, SQUARE));
        render(<MapView apiKey="test-key" />);
        succeed();
        await generateRoute();
        fireEvent.click(screen.getByRole("button", { name: "出発" }));
      }

      it("逆向きに歩き出すと、歩いた距離が増え、兄貴が切り替えの一言を言い、逆回りの少し前に来る", async () => {
        await startSquareWalk();
        move(east(20));
        move(east(45));
        expect(screen.getByTestId("walk-progress")).toHaveTextContent(
          /歩いた 4\d m/,
        );
        expect(screen.getByTestId("aniki-line")).toHaveTextContent(
          "そっちか！ならこっちだ、俺についてこい！",
        );
        // 兄貴は東へ 45m + 10m の位置
        expect(Number(container().getAttribute("data-aniki-lng"))).toBeCloseTo(
          east(55).lng,
          5,
        );
        expect(Number(container().getAttribute("data-aniki-lat"))).toBeCloseTo(
          HERE.lat,
          5,
        );
      });

      it("逆回りに切り替えると、線の矢印も逆向きにする", async () => {
        await startSquareWalk();
        move(east(20));
        move(east(45));
        expect(mocks.polylines.at(-1)!.setOptions).toHaveBeenCalledWith({
          icons: [
            expect.objectContaining({
              icon: expect.objectContaining({
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              }),
            }),
          ],
        });
      });
    });

    describe("兄貴が少し前を歩く（#51）", () => {
      const anikiAt = () => ({
        lat: Number(container().getAttribute("data-aniki-lat")),
        lng: Number(container().getAttribute("data-aniki-lng")),
      });
      // ルートは出発点（HERE）から北へ進む。緯度 1° ≒ 111km
      const NORTH_10M = 10 / 111_000;

      it("ルートがないときは兄貴を地図に出さない", () => {
        render(<MapView apiKey="test-key" />);
        succeed();
        expect(container()).not.toHaveAttribute("data-aniki-lat");
        expect(container()).not.toHaveAttribute("data-aniki-lng");
        expect(screen.queryByTestId("aniki-marker")).toBeNull();
      });

      it("ルートができると、出発点から 10m 先のルート上に兄貴を出す", async () => {
        fetchMock.mockResolvedValue(routeResponse(200, LOOP_POLYLINE));
        render(<MapView apiKey="test-key" />);
        succeed();
        await generateRoute();
        expect(anikiAt().lat).toBeCloseTo(HERE.lat + NORTH_10M, 5);
        expect(anikiAt().lng).toBeCloseTo(HERE.lng, 5);
      });

      it("兄貴のマーカーは、今の場面の表情の画像を出す", async () => {
        fetchMock.mockResolvedValue(routeResponse(200, LOOP_POLYLINE));
        render(<MapView apiKey="test-key" />);
        succeed();
        await generateRoute();
        // ルートができた場面（found）は笑顔。吹き出しの兄貴と同じ表情
        expect(
          screen.getByTestId("aniki-marker").getAttribute("src"),
        ).toContain(encodeURIComponent("/aniki/smile.png"));
      });

      it("散歩中に進むと、兄貴も歩いた距離 + 10m の位置へ進む", async () => {
        await startWalk();
        // 北へ約 222m 進む
        const ahead = { lat: HERE.lat + 0.002, lng: HERE.lng };
        move(ahead);
        expect(anikiAt().lat).toBeCloseTo(ahead.lat + NORTH_10M, 5);
        // 止まっていれば兄貴も待つ
        move(ahead);
        expect(anikiAt().lat).toBeCloseTo(ahead.lat + NORTH_10M, 5);
      });
    });

    it("「出発」を押すと現在地を追いかけ、動くたびに歩いた距離と残りの距離を更新する", async () => {
      await startWalk();
      expect(geo.watchPosition).toHaveBeenCalledTimes(1);
      // 散歩中は「別のルート」と「条件を変える」を隠す
      expect(screen.queryByRole("button", { name: "別のルート" })).toBeNull();
      expect(screen.queryByRole("button", { name: "条件を変える" })).toBeNull();

      move(HERE);
      const progress = () => screen.getByTestId("walk-progress");
      expect(progress()).toHaveTextContent("歩いた 0 m / 残り 1.5 km");
      move({ lat: 35.6915, lng: 139.6917 });
      expect(progress()).toHaveTextContent("歩いた 222 m / 残り 1.3 km");
      move({ lat: 35.6935, lng: 139.6917 });
      expect(progress()).toHaveTextContent("歩いた 445 m / 残り 1.1 km");
    });

    it("散歩中は地図を現在地に追従させ、指で動かしたらやめ、「現在地に戻る」で再開する", async () => {
      await startWalk();
      mocks.panTo.mockClear();
      const next = { lat: 35.6915, lng: 139.6917 };
      move(next);
      expect(mocks.panTo).toHaveBeenLastCalledWith(next);

      act(() => (mocks.mapProps!.onDragstart as () => void)());
      mocks.panTo.mockClear();
      move({ lat: 35.6935, lng: 139.6917 });
      expect(mocks.panTo).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "現在地に戻る" }));
      expect(mocks.panTo).toHaveBeenLastCalledWith({
        lat: 35.6935,
        lng: 139.6917,
      });
    });

    it("「終了」を押すと追いかけるのをやめ、ルートを作った直後の画面に戻る", async () => {
      await startWalk();
      fireEvent.click(screen.getByRole("button", { name: "終了" }));
      expect(geo.clearWatch).toHaveBeenCalledWith(7);
      expect(screen.queryByTestId("walk-progress")).toBeNull();
      expect(screen.getByTestId("route-summary")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "出発" })).toBeInTheDocument();
    });

    it("位置情報の許可がないときは「現在地を取得できません」を出す。一時的な失敗では止めない", async () => {
      await startWalk();
      const failWatch = (code: 1 | 2 | 3) =>
        act(() =>
          geo.watchPosition.mock.lastCall![1]({
            code,
            message: "",
            PERMISSION_DENIED: 1,
          } as GeolocationPositionError),
        );
      // 取得不能（2）・タイムアウト（3）は、次の位置を待つ
      failWatch(2);
      failWatch(3);
      expect(screen.queryByRole("alert")).toBeNull();
      move(HERE);
      expect(screen.getByTestId("walk-progress")).toBeInTheDocument();

      failWatch(1);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "現在地を取得できません",
      );
      expect(screen.getByRole("button", { name: "終了" })).toBeInTheDocument();
    });

    it("位置情報の許可がないときは、兄貴が位置情報の許可を頼む", async () => {
      await startWalk();
      expect(screen.getByTestId("aniki-line")).toHaveTextContent(
        "よし、行くぞ！俺についてこい！",
      );
      act(() =>
        geo.watchPosition.mock.lastCall![1]({
          code: 1,
          message: "",
          PERMISSION_DENIED: 1,
        } as GeolocationPositionError),
      );
      expect(screen.getByTestId("aniki-line")).toHaveTextContent(
        "今どこにいるか分からないな…位置情報を許可してくれるか？",
      );
    });
    it("ルートから外れた位置が2回続けて届くと「ルートから外れています」を出し、戻ると消す", async () => {
      await startWalk();
      move(HERE);
      // 区間の途中から西へ約 90m
      const off = { lat: 35.6915, lng: 139.6907 };
      move(off);
      expect(screen.queryByRole("alert")).toBeNull();
      move(off);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "ルートから外れています",
      );
      move({ lat: 35.6915, lng: 139.6917 });
      expect(screen.queryByRole("alert")).toBeNull();
    });

    describe("外れの判定に GPS の精度を使う（#53）", () => {
      // ルートの最初の区間（出発点から北へ）の途中から、西へ約 30m（隣の道を歩いている想定）
      const nextStreet = { lat: 35.6915, lng: 139.6917 - 30 / 90_300 };

      it("精度が良い（10m）ときは、30m 離れた位置が2回続くと外れを知らせる", async () => {
        await startWalk();
        move(HERE, 10);
        move(nextStreet, 10);
        expect(screen.queryByRole("alert")).toBeNull();
        move(nextStreet, 10);
        expect(screen.getByRole("alert")).toHaveTextContent(
          "ルートから外れています",
        );
      });

      it("精度が悪い（40m）ときは、30m 離れても外れにしない", async () => {
        await startWalk();
        move(HERE, 40);
        move(nextStreet, 40);
        move(nextStreet, 40);
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });

    it("「出発」で画面のスリープ防止を取得し、「終了」で解放する", async () => {
      const release = vi.fn(async () => {});
      const request = vi.fn(async () => ({ release }));
      vi.stubGlobal("navigator", {
        ...navigator,
        wakeLock: { request },
      });
      await startWalk();
      await act(async () => {});
      expect(request).toHaveBeenCalledWith("screen");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "終了" }));
      });
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("スリープ防止が使えない・断られた環境でも、散歩は続けられる", async () => {
      // jsdom の navigator には wakeLock がない
      await startWalk();
      move(HERE);
      expect(screen.getByTestId("walk-progress")).toBeInTheDocument();
      cleanup();

      vi.stubGlobal("navigator", {
        ...navigator,
        wakeLock: {
          request: vi.fn(async () => {
            throw new Error("NotAllowedError");
          }),
        },
      });
      await startWalk();
      await act(async () => {});
      move(HERE);
      expect(screen.getByTestId("walk-progress")).toBeInTheDocument();
    });
  });
});
