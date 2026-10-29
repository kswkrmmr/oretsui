import { expect, test, type Page } from "@playwright/test";
import { finishWalk, moveDuringWalk, startWalk } from "./helpers";

// 途中で切り上げて帰る（#93）
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
// 北へ約 222m の地点
const NORTH_222M = { latitude: 35.6915, longitude: 139.6917 };
// そこから南へまっすぐ出発点に戻る帰り道（約 222m）
const HOME_ROUTE = {
  distanceMeters: 222,
  durationSeconds: 170,
  encodedPolyline: "{~yxEcprsYnK?",
};

test.beforeEach(async ({ page, context }) => {
  // 兄貴のセリフは候補から乱数で選ぶ（#92）。先頭が選ばれるよう固定する
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.clock.install();
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({ json: LOOP_ROUTE }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
});

/** 出発して北へ約 222m 歩く */
async function walkNorth(
  page: Page,
  context: Parameters<typeof moveDuringWalk>[1],
) {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  await moveDuringWalk(page, context, NORTH_222M);
}

test("「終了」で終わり方の選択肢が出て、「やめる」で散歩に戻り、「ここで終わる」で終わる", async ({
  page,
  context,
}) => {
  await walkNorth(page, context);
  await page.getByRole("button", { name: "終了" }).click();
  for (const name of ["ここで終わる", "出発点まで帰る", "やめる"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.getByRole("button", { name: "ここで終わる" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("walk-progress")).toContainText("歩いた 222 m");

  await finishWalk(page);
  await expect(page.getByTestId("walk-summary")).toBeVisible();
});

test("「出発点まで帰る」で帰り道になり、歩いた距離は通算、残りは帰り道で数える", async ({
  page,
  context,
}) => {
  await page.route("**/api/return", (route) =>
    route.fulfill({ json: HOME_ROUTE }),
  );
  await walkNorth(page, context);
  await page.getByRole("button", { name: "終了" }).click();
  await page.getByRole("button", { name: "出発点まで帰る" }).click();

  const progress = page.getByTestId("walk-progress");
  await expect(progress).toHaveText("歩いた 222 m / 帰り道の残り 222 m");
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "今日はここまでにしとくか。帰り道は任せな",
  );
  // 兄貴は帰り道（南向き）の 10m 先にいる。元のルートなら北の先にいる
  const anikiLat = Number(
    await mapContainer(page).getAttribute("data-aniki-lat"),
  );
  expect(anikiLat).toBeLessThan(NORTH_222M.latitude);

  // 帰り道を南へ約 111m。歩いた距離は 222.4m + 111.2m ≒ 334m
  await moveDuringWalk(page, context, {
    latitude: 35.6905,
    longitude: 139.6917,
  });
  await expect(progress).toHaveText("歩いた 334 m / 帰り道の残り 111 m");

  // 帰っている間は「出発点まで帰る」を出さない
  await page.getByRole("button", { name: "終了" }).click();
  await expect(
    page.getByRole("button", { name: "出発点まで帰る" }),
  ).toHaveCount(0);
  await page.clock.runFor(180_000);
  await page.getByRole("button", { name: "ここで終わる" }).click();
  // まとめは切り上げる前と帰り道の合計
  await expect(page.getByTestId("walk-summary")).toHaveText(
    "今日の散歩 3分・334 m",
  );
});

test("帰り道を作れなかったら、元のルートのまま散歩を続け、再試行できる", async ({
  page,
  context,
}) => {
  let fail = true;
  await page.route("**/api/return", (route) =>
    fail
      ? route.fulfill({ status: 502, json: { error: "x" } })
      : route.fulfill({ json: HOME_ROUTE }),
  );
  await walkNorth(page, context);
  await page.getByRole("button", { name: "終了" }).click();
  await page.getByRole("button", { name: "出発点まで帰る" }).click();

  await expect(page.getByText("帰り道を作れませんでした")).toBeVisible();
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "すまん、帰り道が見つからなかった。もう一回いいか？",
  );
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 222 m / 残り 1.3 km",
  );

  fail = false;
  await page.getByRole("button", { name: "再試行" }).click();
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 222 m / 帰り道の残り 222 m",
  );
  await expect(page.getByText("帰り道を作れませんでした")).toHaveCount(0);
});
