import { expect, test } from "@playwright/test";
import { finishWalk, moveDuringWalk, startWalk } from "./helpers";

const HERE = { latitude: 35.6895, longitude: 139.6917 };
// 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
const LOOP_ROUTE = {
  distanceMeters: 1500,
  durationSeconds: 1200,
  encodedPolyline: "kryxEcprsY_X??g^~Wf^",
  waypoints: [],
  withinTolerance: true,
};

test.beforeEach(async ({ page, context }) => {
  // 時計を偽物にして、経過時間を進められるようにする（#68）
  await page.clock.install();
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({ json: LOOP_ROUTE }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
});

test("出発して時計を進めると、経過時間が増える", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  const elapsed = page.getByTestId("walk-elapsed");
  await expect(elapsed).toHaveText("経過 0:00");
  await page.clock.runFor(65_000);
  await expect(elapsed).toHaveText("経過 1:05");
});

test("終了すると、今日の散歩のまとめが出る", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  // 北へ約 222m
  await moveDuringWalk(page, context, {
    latitude: 35.6915,
    longitude: 139.6917,
  });
  await page.clock.runFor(120_000);
  await finishWalk(page);
  await expect(page.getByTestId("walk-summary")).toHaveText(
    "今日の散歩 2分・222 m",
  );
  await expect(page.getByTestId("walk-elapsed")).toHaveCount(0);
});
