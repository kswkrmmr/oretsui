// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialRadius, loopWaypoints } from "@/lib/loop-route";
import { POST } from "./route";

const START = { lat: 35.6895, lng: 139.6917 };

// テストで本物の Routes API を呼ばないよう、fetch をモックする
const fetchMock = vi.fn<typeof fetch>();

function routesResponse(distanceMeters: number) {
  return new Response(
    JSON.stringify({
      routes: [
        {
          distanceMeters,
          duration: "1500s",
          polyline: { encodedPolyline: `line-${distanceMeters}` },
        },
      ],
    }),
  );
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/route", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** Routes API に渡した経由地 */
function requestedWaypoints(call: number) {
  const body = JSON.parse(fetchMock.mock.calls[call][1]!.body as string);
  return body.intermediates.map(
    (p: { location: { latLng: { latitude: number; longitude: number } } }) => ({
      lat: p.location.latLng.latitude,
      lng: p.location.latLng.longitude,
    }),
  );
}

describe("POST /api/route", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "server-key");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("目標距離に近い周回ルートを返す", async () => {
    fetchMock.mockResolvedValue(routesResponse(2100));
    const response = await post({ start: START, meters: 2000, rotation: 30 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      distanceMeters: 2100,
      durationSeconds: 1500,
      encodedPolyline: "line-2100",
      waypoints: loopWaypoints(START, initialRadius(2000), 30),
      withinTolerance: true,
    });
    const headers = fetchMock.mock.calls[0][1]!.headers as Record<
      string,
      string
    >;
    expect(headers["X-Goog-Api-Key"]).toBe("server-key");
  });

  it("±10% に入るまで半径を調整し、入らなければ一番近いルートを返す", async () => {
    // 一番近いルート（2250）が最後ではなく途中に来るようにする
    for (const meters of [3000, 2250, 2600, 2400]) {
      fetchMock.mockResolvedValueOnce(routesResponse(meters));
    }
    const response = await post({ start: START, meters: 2000, rotation: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(await response.json()).toMatchObject({
      distanceMeters: 2250,
      withinTolerance: false,
    });
  });

  it("回転角を省くと、サーバーがランダムに決める", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    fetchMock.mockResolvedValue(routesResponse(2000));
    await post({ start: START, meters: 2000 });
    expect(requestedWaypoints(0)).toEqual(
      loopWaypoints(START, initialRadius(2000), 90),
    );
  });

  it.each([
    ["JSON でない", "not json"],
    ["出発点がない", { meters: 2000 }],
    ["緯度が範囲外", { start: { lat: 91, lng: 139 }, meters: 2000 }],
    ["経度が数でない", { start: { lat: 35, lng: "139" }, meters: 2000 }],
    ["距離が0以下", { start: START, meters: 0 }],
    ["距離が 20km を超える", { start: START, meters: 20001 }],
    ["回転角が数でない", { start: START, meters: 2000, rotation: "north" }],
  ])("入力が不正（%s）なら 400 を返し、API を呼ばない", async (_, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("距離はちょうど 20km までなら受け付ける", async () => {
    fetchMock.mockResolvedValue(routesResponse(20000));
    const response = await post({ start: START, meters: 20000 });
    expect(response.status).toBe(200);
  });

  it("サーバー用のキーが未設定なら 500 を返す", async () => {
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "");
    const response = await post({ start: START, meters: 2000 });
    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Routes API が失敗したら 502 を返し、原因をサーバーのログに残す", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    const response = await post({ start: START, meters: 2000 });
    expect(response.status).toBe(502);
    expect(log).toHaveBeenCalled();
  });

  it("ルートが1本も取れなければ 502 を返す", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    const response = await post({ start: START, meters: 2000 });
    expect(response.status).toBe(502);
  });
});
