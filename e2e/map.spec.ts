import { expect, test, type Page } from "@playwright/test";

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

test.beforeEach(async ({ page }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
});

test("地図コンテナが画面の幅と高さいっぱいに表示される", async ({ page }) => {
  await page.goto("/");
  const map = mapContainer(page);
  await expect(map).toBeVisible();

  const box = await map.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBe(0);
  expect(box!.y).toBe(0);
  expect(Math.round(box!.width)).toBe(viewport!.width);
  expect(Math.round(box!.height)).toBe(viewport!.height);
});

test("地図を表示しても横スクロールが出ない", async ({ page }) => {
  await page.goto("/");
  await expect(mapContainer(page)).toBeVisible();
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
});
