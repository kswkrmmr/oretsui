import { expect, test } from "@playwright/test";
import { finishWalk, startWalk } from "./helpers";

// 散歩中、向いている方角を上にするか北を上にするかを切り替える（#69）。
// テストの環境には方角のセンサーがないので、切り替えのボタンと状態だけを確かめる
test.beforeEach(async ({ page, context }) => {
  // センサーがないと3秒後に「方角が分からない」になり、方位のボタンが消える。
  // ボタンの切り替えを確かめるため、時計を止めておく。
  // Playwright の時計は install しただけでは進み続けるので、pauseAt で止める
  await page.clock.install({ time: new Date("2026-10-22T10:00:00") });
  await page.clock.pauseAt(new Date("2026-10-22T10:00:01"));
  // 方角の許可を求める関数があれば（Chromium・iPhone の Safari）、ユーザーが「許可」を押したことにする。
  // テストでは誰も許可を押さないので、そのままだと「拒否」になり北が上になる
  await page.addInitScript(() => {
    const OrientationEvent = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    if (typeof OrientationEvent?.requestPermission === "function")
      OrientationEvent.requestPermission = async () => "granted";
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

  await finishWalk(page);
  await expect(map).not.toHaveAttribute("data-heading-mode");
});
