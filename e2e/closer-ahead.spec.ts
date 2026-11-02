import { expect, test } from "@playwright/test";
import { moveDuringWalk, startWalk } from "./helpers";

// 途中で帰るとき、元のルートの残りのほうが近ければ兄貴が教える（#96）
const HERE = { latitude: 35.6895, longitude: 139.6917 };
// 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
const LOOP_ROUTE = {
  distanceMeters: 1500,
  durationSeconds: 1200,
  encodedPolyline: "kryxEcprsY_X??g^~Wf^",
  waypoints: [],
  withinTolerance: true,
};
// 北へ約 222m の地点から、南へまっすぐ出発点に戻る帰り道（線は約 222m）
const HOME_LINE = "{~yxEcprsYnK?";

test.beforeEach(async ({ page, context }) => {
  // 兄貴のセリフは候補から乱数で選ぶ（#92）。先頭が選ばれるよう固定する
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({ json: LOOP_ROUTE }),
  );
  // 帰り道が元のルートの残り（約 1.3km）より長い、と返す
  await page.route("**/api/return", (route) =>
    route.fulfill({
      json: {
        distanceMeters: 2000,
        durationSeconds: 1500,
        encodedPolyline: HOME_LINE,
      },
    }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  await moveDuringWalk(page, context, {
    latitude: 35.6915,
    longitude: 139.6917,
  });
  await page.getByRole("button", { name: "終了" }).click();
  await page.getByRole("button", { name: "出発点まで帰る" }).click();
});

test("元のルートの残りのほうが近いときは、兄貴が教えて、2つのボタンを出す", async ({
  page,
}) => {
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "このまま進んだほうが近いぞ",
  );
  for (const name of ["このまま進む", "それでも帰り道にする"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
  }
  // まだ帰り道にはしない
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 222 m / 残り 1.3 km",
  );
});

test("「このまま進む」で元のルートのまま散歩を続ける", async ({ page }) => {
  await page.getByRole("button", { name: "このまま進む" }).click();
  await expect(page.getByRole("button", { name: "このまま進む" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 222 m / 残り 1.3 km",
  );
  await expect(page.getByRole("button", { name: "終了" })).toBeVisible();
});

test("「それでも帰り道にする」で帰り道に差し替える", async ({ page }) => {
  await page.getByRole("button", { name: "それでも帰り道にする" }).click();
  await expect(page.getByTestId("walk-progress")).toHaveText(
    "歩いた 222 m / 帰り道の残り 222 m",
  );
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "今日はここまでにしとくか。帰り道は任せな",
  );
});
