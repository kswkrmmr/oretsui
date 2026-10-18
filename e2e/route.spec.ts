import { expect, test, type Page, type Route } from "@playwright/test";

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

// ルート検索 API（/api/route）の返事。本物の Routes API は呼ばない
const ROUTE = {
  distanceMeters: 2134,
  durationSeconds: 1620,
  encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  waypoints: [],
  withinTolerance: true,
};
const fulfillRoute = (route: Route) => route.fulfill({ json: ROUTE });
const failRoute = (route: Route) =>
  route.fulfill({ status: 502, json: { error: "ルート検索に失敗しました" } });

test.beforeEach(async ({ page, context }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  // 出発点がないと「ルートを作る」を押せないので、現在地を出発点にする
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.6895, longitude: 139.6917 });
});

test("ルートを作ると、生成中の表示のあとに距離と時間が表示される", async ({
  page,
}) => {
  // 返事を止めておき、生成中の表示を確かめてから返す
  let respond = () => {};
  const requested = new Promise<Record<string, unknown>>((resolve) => {
    page.route("**/api/route", (route) => {
      resolve(route.request().postDataJSON());
      respond = () => void fulfillRoute(route);
    });
  });

  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();

  expect(await requested).toEqual({
    start: { lat: 35.6895, lng: 139.6917 },
    meters: 2400,
  });
  await expect(
    page.getByRole("button", { name: "ルートを作成中…" }),
  ).toBeDisabled();

  respond();
  const summary = page.getByTestId("route-summary");
  await expect(summary).toContainText("2.1 km");
  await expect(summary).toContainText("27分");
  await expect(
    page.getByRole("button", { name: "ルートを作る" }),
  ).toBeEnabled();
});

test("生成に失敗するとエラーと再試行ボタンが出て、再試行で作り直せる", async ({
  page,
}) => {
  await page.route("**/api/route", failRoute);
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();

  // Next.js のページ遷移の読み上げ用にも role="alert" があるので、シートの中に絞る
  const sheet = page.getByRole("region", { name: "散歩の条件" });
  await expect(sheet.getByRole("alert")).toContainText(
    "ルートを作れませんでした",
  );
  const retry = page.getByRole("button", { name: "再試行" });
  const box = await retry.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await page.unroute("**/api/route");
  await page.route("**/api/route", fulfillRoute);
  await retry.click();
  await expect(page.getByTestId("route-summary")).toContainText("2.1 km");
  await expect(sheet.getByRole("alert")).toHaveCount(0);
});
