import { expect, test, type Page } from "@playwright/test";

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

test.beforeEach(async ({ page, context }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  // 出発点がないと「ルートを作る」を押せないので、現在地を出発点にする
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.6895, longitude: 139.6917 });
  // 本物の Routes API を呼ばないよう、ルート検索 API の返事を決めておく
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: {
        distanceMeters: 2134,
        durationSeconds: 1620,
        encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        waypoints: [],
        withinTolerance: true,
      },
    }),
  );
});

test("条件を選んで「ルートを作る」を押すと、生成処理が呼ばれる", async ({
  page,
}) => {
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );

  await page.getByRole("button", { name: "60分" }).click();
  await page.getByRole("button", { name: "ゆっくり" }).click();
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await expect(mapContainer(page)).toHaveAttribute(
    "data-route-distance",
    "3600",
  );

  // ルートを作ると条件が隠れるので、「条件を変える」で戻してから選び直す
  await page.getByRole("button", { name: "条件を変える" }).click();
  await page.getByRole("button", { name: "距離" }).click();
  await page.getByRole("button", { name: "5km" }).click();
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await expect(mapContainer(page)).toHaveAttribute(
    "data-route-distance",
    "5000",
  );
});

test("条件のシートのボタンは、どれもタップ領域が 44px 以上ある", async ({
  page,
}) => {
  await page.goto("/");
  const sheet = page.getByRole("region", { name: "散歩の条件" });
  await expect(sheet).toBeVisible();

  // 時間モードと距離モードの両方のボタンを確かめる
  for (const mode of ["時間", "距離"]) {
    await sheet.getByRole("button", { name: mode }).click();
    for (const button of await sheet.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("「現在地に戻る」ボタンが、シートのすぐ上にある", async ({ page }) => {
  await page.goto("/");
  const sheet = await page
    .getByRole("region", { name: "散歩の条件" })
    .boundingBox();
  const button = await page
    .getByRole("button", { name: "現在地に戻る" })
    .boundingBox();
  expect(sheet).not.toBeNull();
  expect(button).not.toBeNull();
  // ボタンの下端がシートの上端より上にあり、離れすぎていない
  const gap = sheet!.y - (button!.y + button!.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(24);
});
