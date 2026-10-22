import { expect, test } from "@playwright/test";
import { startWalk } from "./helpers";

// 散歩中、向いている方角を上にするか北を上にするかを切り替える（#69）。
// テストの環境には方角のセンサーがないので、切り替えのボタンと状態だけを確かめる
test.beforeEach(async ({ page, context }) => {
  // センサーがないと3秒後に「方角が分からない」になり、方位のボタンが消える。
  // ボタンの切り替えを確かめるため、時計を止めておく
  await page.clock.install();
  // Playwright の Chromium には DeviceOrientationEvent がなく、「センサーなし」とみなされる。
  // センサーのあるスマホとして振る舞わせる（方角のイベントは届かないが、時計を止めているので待ち続ける）
  await page.addInitScript(() => {
    if (!("DeviceOrientationEvent" in window))
      Object.assign(window, { DeviceOrientationEvent: class extends Event {} });
  });
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

test("出発すると方位のボタンが出て、押すと地図の向きの設定が切り替わる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ルートを作る" }).click();
  const map = page.getByTestId("map").first();
  await expect(map).not.toHaveAttribute("data-heading-mode");
  await startWalk(page);
  await expect(map).toHaveAttribute("data-heading-mode", "device");

  const toNorth = page.getByRole("button", { name: "北を上にする" });
  const box = await toNorth.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await toNorth.click();
  await expect(map).toHaveAttribute("data-heading-mode", "north");
  await page.getByRole("button", { name: "向いている方角を上にする" }).click();
  await expect(map).toHaveAttribute("data-heading-mode", "device");

  await page.getByRole("button", { name: "終了" }).click();
  await expect(map).not.toHaveAttribute("data-heading-mode");
});
