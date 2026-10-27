import { expect, test } from "@playwright/test";
import { moveDuringWalk, startWalk } from "./helpers";

// 消費カロリー（#89）。体重を入れたときだけ、散歩中とまとめに出す
const HERE = { latitude: 35.6895, longitude: 139.6917 };
// 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
const LOOP_ROUTE = {
  distanceMeters: 1500,
  durationSeconds: 1200,
  encodedPolyline: "kryxEcprsY_X??g^~Wf^",
  waypoints: [],
  withinTolerance: true,
};
// 北へ約 222m
const NORTH_222M = { latitude: 35.6915, longitude: 139.6917 };

test.beforeEach(async ({ page, context }) => {
  await page.clock.install();
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({ json: LOOP_ROUTE }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
});

test("体重の欄は数字のキーボードが出て、タップしやすい大きさ", async ({
  page,
}) => {
  await page.goto("/");
  const weight = page.getByLabel("体重");
  await expect(weight).toHaveAttribute("inputmode", "numeric");
  const box = await weight.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("入れた体重は保存され、開き直しても残っている", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("体重").fill("60");
  await page.reload();
  await expect(page.getByLabel("体重")).toHaveValue("60");
});

test("体重を入れて散歩すると、散歩中とまとめに消費カロリーが出る", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("体重").fill("60");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  const calories = page.getByTestId("walk-calories");
  await expect(calories).toHaveText("約 0 kcal");
  // ふつう（80 m/分）で 222m → 2.775分。3.5 × 60 × (2.775 / 60) × 1.05 ≒ 10
  await moveDuringWalk(page, context, NORTH_222M);
  await expect(calories).toHaveText("約 10 kcal");
  await page.clock.runFor(120_000);
  await page.getByRole("button", { name: "終了" }).click();
  await expect(page.getByTestId("walk-summary")).toHaveText(
    "今日の散歩 2分・222 m・約 10 kcal",
  );
});

test("体重を入れていないと、消費カロリーは出ない", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  await moveDuringWalk(page, context, NORTH_222M);
  await expect(page.getByTestId("walk-calories")).toHaveCount(0);
  await page.clock.runFor(120_000);
  await page.getByRole("button", { name: "終了" }).click();
  await expect(page.getByTestId("walk-summary")).toHaveText(
    "今日の散歩 2分・222 m",
  );
});

test("範囲外の体重では、消費カロリーは出ない", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("体重").fill("300");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  await expect(page.getByTestId("walk-calories")).toHaveCount(0);
});
