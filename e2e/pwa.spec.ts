import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
});

/** ページが指している manifest を取得する */
async function fetchManifest(page: import("@playwright/test").Page) {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(href!);
  expect(response.ok()).toBe(true);
  return response.json();
}

test("manifest が取得でき、ホーム画面に追加するための必須項目がそろっている", async ({
  page,
}) => {
  const manifest = await fetchManifest(page);
  expect(manifest).toMatchObject({
    name: "俺についてこい",
    short_name: "俺つい",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#16a34a",
    background_color: "#ffffff",
  });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  // Android の丸い枠でも切れない maskable 版もある
  expect(manifest.icons).toContainEqual(
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  );
});

test("manifest のアイコンは、どれも書かれた大きさの PNG 画像として返る", async ({
  page,
}) => {
  const manifest = await fetchManifest(page);
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
    const body = await response.body();
    // PNG のヘッダー（IHDR）から幅と高さを読む
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    expect(`${width}x${height}`).toBe(icon.sizes);
  }
});

test("iPhone の Safari 用のメタタグと apple-touch-icon がページに入っている", async ({
  page,
}) => {
  await page.goto("/");
  const meta = (name: string) =>
    page.locator(`meta[name="${name}"]`).getAttribute("content");
  expect(await meta("apple-mobile-web-app-capable")).toBe("yes");
  expect(await meta("apple-mobile-web-app-title")).toBe("俺つい");
  expect(await meta("apple-mobile-web-app-status-bar-style")).toBe("default");
  expect(await meta("theme-color")).toBe("#16a34a");

  const href = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  const response = await page.request.get(href!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16)).toBe(180);
});
