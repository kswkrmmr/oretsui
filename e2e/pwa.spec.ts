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
  // 画像を差し替えたらスマホが取りに行き直すよう、URL に版が付いている（#86）
  for (const icon of manifest.icons as { src: string }[])
    expect(icon.src).toMatch(/^\/icons\/[a-z0-9-]+\.png\?v=[0-9a-f]{8}$/);
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
  // iPhone 用のアイコンにも、manifest と同じ版が付いている（#86）
  const manifest = await (
    await page.request.get(
      (await page.locator('link[rel="manifest"]').getAttribute("href"))!,
    )
  ).json();
  const version = new URL(manifest.icons[0].src, "http://x").searchParams.get(
    "v",
  );
  expect(href).toBe(`/icons/apple-touch-icon.png?v=${version}`);
  const response = await page.request.get(href!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(body.readUInt32BE(16)).toBe(180);
});

test("ホーム画面のアイコンは兄貴の画像になっている（緑一色の仮のアイコンではない）（#84）", async ({
  page,
}) => {
  await page.goto("/");
  // ブラウザの中でアイコンを canvas に描き、テーマカラーの緑（#16a34a）に近くない画素の割合を数える
  const stats = await page.evaluate(async () => {
    const blob = await (await fetch("/icons/icon-512.png")).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let other = 0;
    let transparent = 0;
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 255) transparent++;
      // 色の数（下位ビットを落として数える）
      colors.add(
        ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3),
      );
      const distance =
        Math.abs(data[i] - 0x16) +
        Math.abs(data[i + 1] - 0xa3) +
        Math.abs(data[i + 2] - 0x4a);
      if (distance > 60) other++;
    }
    const pixels = data.length / 4;
    return { otherRatio: other / pixels, transparent, colors: colors.size };
  });
  // 仮のアイコンは大部分が緑。兄貴の画像なら、緑でない画素がほとんどを占める
  expect(stats.otherRatio).toBeGreaterThan(0.8);
  // 画像が読み込めずに透明や一色になっていないこと（透明・一色でも「緑でない」と数えられてしまうため）
  expect(stats.transparent).toBe(0);
  expect(stats.colors).toBeGreaterThan(1000);
});
