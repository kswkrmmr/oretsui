import { expect, test, type Page } from "@playwright/test";

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

const HERE = { latitude: 35.6895, longitude: 139.6917 };
// 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
const LOOP_ROUTE = {
  distanceMeters: 1500,
  durationSeconds: 1200,
  encodedPolyline: "kryxEcprsY_X??g^~Wf^",
  waypoints: [],
  withinTolerance: true,
};
// 緯度 1° ≒ 111km。ルートは北へ進むので、30m 先は緯度だけ増える
const NORTH_30M = 30 / 111_000;

/** 地図の入れ物に出した兄貴の位置（属性がなければ null） */
const anikiAt = (page: Page) =>
  mapContainer(page).evaluate((element) => {
    const lat = element.getAttribute("data-aniki-lat");
    const lng = element.getAttribute("data-aniki-lng");
    return lat === null || lng === null
      ? null
      : { lat: Number(lat), lng: Number(lng) };
  });

test.beforeEach(async ({ page, context }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({ json: LOOP_ROUTE }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
});

test("ルートを作ると、兄貴が出発点から約30m先のルート上に出る", async ({
  page,
}) => {
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  expect(await anikiAt(page)).toBeNull();

  await page.getByRole("button", { name: "ルートを作る" }).click();
  await expect.poll(() => anikiAt(page)).not.toBeNull();
  const aniki = (await anikiAt(page))!;
  expect(aniki.lat).toBeCloseTo(HERE.latitude + NORTH_30M, 5);
  expect(aniki.lng).toBeCloseTo(HERE.longitude, 5);
});

test("散歩中に位置を進めると、兄貴も先へ進む", async ({ page, context }) => {
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await page.getByRole("button", { name: "出発" }).click();
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 0 m / 残り 1.5 km",
  );

  // 北へ約 222m 進む
  await context.setGeolocation({ latitude: 35.6915, longitude: 139.6917 });
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 222 m / 残り 1.3 km",
  );
  const aniki = (await anikiAt(page))!;
  expect(aniki.lat).toBeCloseTo(35.6915 + NORTH_30M, 5);
  expect(aniki.lng).toBeCloseTo(139.6917, 5);
});
