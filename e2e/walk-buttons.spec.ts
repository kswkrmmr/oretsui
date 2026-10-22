import { expect, test, type Locator, type Page } from "@playwright/test";
import { startWalk } from "./helpers";

// 「出発」「終了」のボタンを横幅いっぱい・少し高くする（#79）
test.beforeEach(async ({ page, context }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: {
        distanceMeters: 1500,
        durationSeconds: 1200,
        encodedPolyline: "kryxEcprsY_X??g^~Wf^",
        waypoints: [],
        withinTolerance: true,
      },
    }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.6895, longitude: 139.6917 });
});

// シートの左右の余白（px-4 = 16px ずつ）
const SHEET_PADDING_X = 32;

/** ボタンがシートの横幅いっぱい（左右の余白を除く）で、高さが 56px 以上か */
async function expectFullWidth(page: Page, button: Locator) {
  const sheet = await page
    .getByRole("region", { name: "散歩の条件" })
    .boundingBox();
  const box = await button.boundingBox();
  expect(sheet).not.toBeNull();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.width - (sheet!.width - SHEET_PADDING_X))).toBeLessThan(
    2,
  );
  expect(box!.height).toBeGreaterThanOrEqual(56);
}

test("「出発」ボタンは横幅いっぱいで、高さ 56px 以上", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  const start = page.getByRole("button", { name: "出発" });
  await expect(start).toBeVisible();
  await expectFullWidth(page, start);
});

test("「終了」ボタンは横幅いっぱいで、高さ 56px 以上", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  const stop = page.getByRole("button", { name: "終了" });
  await expect(stop).toBeVisible();
  await expectFullWidth(page, stop);
});
