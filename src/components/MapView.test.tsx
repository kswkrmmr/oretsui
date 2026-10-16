import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapView } from "./MapView";

// テストで本物の Google Maps を読み込まないよう、ライブラリをモックする
const mapProps = vi.hoisted(() => ({
  last: null as Record<string, unknown> | null,
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: (props: Record<string, unknown>) => {
    mapProps.last = props;
    return <div data-testid="google-map" />;
  },
}));

describe("MapView", () => {
  beforeEach(() => {
    mapProps.last = null;
  });

  it("APIキーが空のとき、エラーメッセージを表示し地図は描画しない", () => {
    render(<MapView apiKey="" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Maps の API キーが設定されていません",
    );
    expect(screen.queryByTestId("google-map")).not.toBeInTheDocument();
    expect(mapProps.last).toBeNull();
  });

  it("地図に東京駅・ズーム15・1本指操作・標準ボタン非表示の設定を渡す", () => {
    render(<MapView apiKey="test-key" />);
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
    expect(mapProps.last).toMatchObject({
      defaultCenter: { lat: 35.681236, lng: 139.767125 },
      defaultZoom: 15,
      gestureHandling: "greedy",
      disableDefaultUI: true,
    });
  });
});
