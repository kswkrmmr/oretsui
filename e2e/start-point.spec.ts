import { expect, test, type Page } from "@playwright/test";

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

const HERE = { latitude: 35.6895, longitude: 139.6917 };

test.beforeEach(async ({ page }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
});

test("位置情報を許可すると、現在地が出発点になる", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
  await page.goto("/");

  const map = mapContainer(page);
  await expect(map).toHaveAttribute("data-start-source", "current");
  await expect(map).toHaveAttribute("data-start-lat", String(HERE.latitude));
  await expect(map).toHaveAttribute("data-start-lng", String(HERE.longitude));
});

test("位置情報を拒否すると、案内が表示される", async ({ page, context }) => {
  // 許可を与えないと、位置情報の取得は拒否される
  await context.clearPermissions();
  await page.goto("/");

  await expect(
    page.getByText(
      "位置情報が使えません。地図をタップして出発点を選んでください",
    ),
  ).toBeVisible();
  await expect(mapContainer(page)).not.toHaveAttribute("data-start-source");
});

test("「現在地に戻る」ボタンが画面右下にあり、48px 以上ある", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "現在地に戻る" });
  await expect(button).toBeVisible();

  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(48);
  expect(box!.height).toBeGreaterThanOrEqual(48);
  // 右下の 1/4 の範囲に収まっている
  expect(box!.x).toBeGreaterThan(viewport!.width / 2);
  expect(box!.y).toBeGreaterThan(viewport!.height / 2);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
});
