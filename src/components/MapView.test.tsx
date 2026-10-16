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
const mocks = vi.hoisted(() => ({
  mapProps: null as Record<string, unknown> | null,
  panTo: vi.fn(),
  // 本物と同じく、同じ地図には同じオブジェクトを返す
  map: null as { panTo: () => void } | null,
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: ({
    children,
    ...props
  }: { children?: React.ReactNode } & Record<string, unknown>) => {
    mocks.mapProps = props;
    return <div data-testid="google-map">{children}</div>;
  },
  useMap: () => (mocks.map ??= { panTo: mocks.panTo }),
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
const NOTICE = "位置情報が使えません。地図をタップして出発点を選んでください";

describe("MapView", () => {
  beforeEach(() => {
    mocks.mapProps = null;
    mocks.panTo.mockClear();
    geo.getCurrentPosition.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: geo.getCurrentPosition },
    });
  });

  afterEach(() => {
    cleanup();
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
});
