import { moveDuringWalk, startWalk } from "./helpers";
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

  // 回転角（#8）はブラウザがランダムに決めて渡す
  const body = await requested;
  expect(body).toEqual({
    start: { lat: 35.6895, lng: 139.6917 },
    meters: 2400,
    rotation: expect.any(Number),
  });
  expect(body.rotation).toBeGreaterThanOrEqual(0);
  expect(body.rotation).toBeLessThan(360);
  // 作成中は条件と「ルートを作る」を隠し、作成中の表示だけを出す
  const sheet = page.getByRole("region", { name: "散歩の条件" });
  await expect(sheet.getByRole("status")).toHaveText("ルートを作成中…");
  await expect(page.getByRole("button", { name: "ルートを作る" })).toHaveCount(
    0,
  );

  respond();
  const summary = page.getByTestId("route-summary");
  await expect(summary).toContainText("2.1 km");
  await expect(summary).toContainText("27分");
  // 作ったあとは「別のルート」と「条件を変える」で操作する
  await expect(page.getByRole("button", { name: "別のルート" })).toBeVisible();
  await page.getByRole("button", { name: "条件を変える" }).click();
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

test("「別のルート」を押すと、回転角を 90〜270° ずらして作り直し、ルートが変わる", async ({
  page,
}) => {
  // 1回目と2回目で違うルートを返し、頼まれた回転角を記録する
  const rotations: number[] = [];
  const routes = [
    ROUTE,
    { ...ROUTE, distanceMeters: 2456, encodedPolyline: "_ibE_seK_seK_seK" },
  ];
  await page.route("**/api/route", (route) => {
    rotations.push(route.request().postDataJSON().rotation);
    return route.fulfill({ json: routes[rotations.length - 1] });
  });

  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  const summary = page.getByTestId("route-summary");
  await expect(summary).toContainText("2.1 km");

  const another = page.getByRole("button", { name: "別のルート" });
  const box = await another.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await another.click();

  await expect(summary).toContainText("2.5 km");
  expect(rotations).toHaveLength(2);
  const shift = (rotations[1] - rotations[0] + 360) % 360;
  expect(shift).toBeGreaterThanOrEqual(90);
  expect(shift).toBeLessThanOrEqual(270);
});

test("「出発」を押すと、位置を動かすたびに歩いた距離と残りの距離が更新される", async ({
  page,
  context,
}) => {
  // 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: { ...ROUTE, encodedPolyline: "kryxEcprsY_X??g^~Wf^" },
    }),
  );
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  const start = page.getByRole("button", { name: "出発" });
  const box = await start.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await start.click();
  await expect(mapContainer(page)).toHaveAttribute("data-walk-updates", "1");

  const progress = page.getByTestId("walk-progress");
  await expect(progress).toHaveText("歩いた 0 m / 残り 1.5 km");
  await moveDuringWalk(page, context, {
    latitude: 35.6915,
    longitude: 139.6917,
  });
  await expect(progress).toHaveText("歩いた 222 m / 残り 1.3 km");
  await moveDuringWalk(page, context, {
    latitude: 35.6935,
    longitude: 139.6917,
  });
  await expect(progress).toHaveText("歩いた 445 m / 残り 1.1 km");

  await page.getByRole("button", { name: "終了" }).click();
  await expect(progress).toHaveCount(0);
  await expect(page.getByRole("button", { name: "別のルート" })).toBeVisible();
});

test("散歩中にルートから外れた位置が2回続くと「ルートから外れています」が出て、ルートに戻ると消える", async ({
  page,
  context,
}) => {
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: { ...ROUTE, encodedPolyline: "kryxEcprsY_X??g^~Wf^" },
    }),
  );
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  const progress = page.getByTestId("walk-progress");
  await expect(progress).toHaveText("歩いた 0 m / 残り 1.5 km");

  // Next.js のページ遷移の読み上げ用にも role="alert" があるので、シートの中に絞る
  const alert = page
    .getByRole("region", { name: "散歩の条件" })
    .getByRole("alert");
  // 区間の途中から西へ約 90m。1回目では知らせない
  await moveDuringWalk(page, context, {
    latitude: 35.6915,
    longitude: 139.6907,
  });
  await expect(progress).toHaveText("歩いた 222 m / 残り 1.3 km");
  await expect(alert).toHaveCount(0);
  // 2回目（少しずらして、位置の更新として届くようにする）
  await moveDuringWalk(page, context, {
    latitude: 35.6916,
    longitude: 139.6907,
  });
  await expect(alert).toHaveText("ルートから外れています");

  await moveDuringWalk(page, context, {
    latitude: 35.6925,
    longitude: 139.6917,
  });
  await expect(alert).toHaveCount(0);
});
