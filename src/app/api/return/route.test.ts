// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const HERE = { lat: 35.7, lng: 139.7 };
const START = { lat: 35.6895, lng: 139.6917 };

// テストで本物の Routes API を呼ばないよう、fetch をモックする
const fetchMock = vi.fn<typeof fetch>();

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/return", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/return（帰り道。#93）", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "server-key");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("今いる場所から出発点までの徒歩ルートを返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 800,
              duration: "600s",
              polyline: { encodedPolyline: "home" },
            },
          ],
        }),
      ),
    );
    const response = await post({ from: HERE, to: START });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      distanceMeters: 800,
      durationSeconds: 600,
      encodedPolyline: "home",
    });
    const [, init] = fetchMock.mock.lastCall!;
    expect(init?.headers).toMatchObject({ "X-Goog-Api-Key": "server-key" });
    const body = JSON.parse(init!.body as string);
    expect(body.origin.location.latLng).toEqual({
      latitude: HERE.lat,
      longitude: HERE.lng,
    });
    expect(body.destination.location.latLng).toEqual({
      latitude: START.lat,
      longitude: START.lng,
    });
  });

  it.each([
    ["JSON でない", "not json"],
    ["to がない", { from: HERE }],
    ["緯度が範囲外", { from: { lat: 91, lng: 139 }, to: START }],
    ["経度が数でない", { from: HERE, to: { lat: 35, lng: "139" } }],
  ])("不正な入力（%s）は 400", async (_, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ルートが見つからなければ 502", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ routes: [] })));
    expect((await post({ from: HERE, to: START })).status).toBe(502);
  });

  it("Routes API がエラーを返したら 502", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await post({ from: HERE, to: START })).status).toBe(502);
  });

  it("キーが設定されていなければ 500", async () => {
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "");
    expect((await post({ from: HERE, to: START })).status).toBe(500);
  });
});
