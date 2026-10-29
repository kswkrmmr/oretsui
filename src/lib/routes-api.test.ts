import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeWalkingRoute,
  computeWalkingRouteTo,
  ROUTES_API_URL,
  RoutesApiError,
} from "./routes-api";

const START = { lat: 35.6895, lng: 139.6917 };
const WAYPOINTS = [
  { lat: 35.7, lng: 139.7 },
  { lat: 35.71, lng: 139.69 },
  { lat: 35.7, lng: 139.68 },
];

const latLng = ({ lat, lng }: { lat: number; lng: number }) => ({
  location: { latLng: { latitude: lat, longitude: lng } },
});

// テストで本物の Routes API を呼ばないよう、fetch をモックする
const fetchMock = vi.fn<typeof fetch>();

function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("computeWalkingRoute", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("出発点に戻る徒歩ルートを、キーと項目の絞り込みを付けて頼む", async () => {
    respond({ routes: [] });
    await computeWalkingRoute("server-key", START, WAYPOINTS, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.lastCall!;
    expect(url).toBe(ROUTES_API_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": "server-key",
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    });
    expect(JSON.parse(init!.body as string)).toEqual({
      origin: latLng(START),
      destination: latLng(START),
      intermediates: WAYPOINTS.map(latLng),
      travelMode: "WALK",
    });
  });

  it("1本目のルートの距離・所要時間（秒）・ポリラインを返す", async () => {
    respond({
      routes: [
        {
          distanceMeters: 2345,
          duration: "1800s",
          polyline: { encodedPolyline: "abc" },
        },
      ],
    });
    expect(
      await computeWalkingRoute("server-key", START, WAYPOINTS, fetchMock),
    ).toEqual({
      distanceMeters: 2345,
      durationSeconds: 1800,
      encodedPolyline: "abc",
    });
  });

  it("ルートが1本もなければ null を返す", async () => {
    respond({});
    expect(
      await computeWalkingRoute("server-key", START, WAYPOINTS, fetchMock),
    ).toBeNull();
  });

  it("API がエラーを返したら RoutesApiError を投げる", async () => {
    respond({ error: { message: "quota" } }, 429);
    await expect(
      computeWalkingRoute("server-key", START, WAYPOINTS, fetchMock),
    ).rejects.toBeInstanceOf(RoutesApiError);
  });
});

describe("computeWalkingRouteTo（帰り道。#93）", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("今いる場所から出発点までの、経由地のない片道の徒歩ルートを頼む", async () => {
    respond({
      routes: [
        {
          distanceMeters: 800,
          duration: "600s",
          polyline: { encodedPolyline: "home" },
        },
      ],
    });
    const HERE = { lat: 35.7, lng: 139.7 };
    const route = await computeWalkingRouteTo(
      "server-key",
      HERE,
      START,
      fetchMock,
    );
    const body = JSON.parse(fetchMock.mock.lastCall![1]!.body as string);
    expect(body).toEqual({
      origin: latLng(HERE),
      destination: latLng(START),
      intermediates: [],
      travelMode: "WALK",
    });
    expect(route).toEqual({
      distanceMeters: 800,
      durationSeconds: 600,
      encodedPolyline: "home",
    });
  });
});
