import { expect, test } from "@playwright/test";

// ルートの長さが目標の ±10% に入らなかったとき、兄貴が言う（#72）
test.beforeEach(async ({ page, context }) => {
  // 兄貴のセリフは候補から乱数で選ぶ（#92）。先頭（今までのセリフ）が選ばれるよう固定する
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.6895, longitude: 139.6917 });
});

test("目標より長く ±10% に入らなかったルートでは、兄貴が「ちょっと長めになっちまった」と言う", async ({
  page,
}) => {
  // 目標は 30分・ふつう → 2400m。2800m で範囲外のルートを返す
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: {
        distanceMeters: 2800,
        durationSeconds: 2000,
        encodedPolyline: "kryxEcprsY_X??g^~Wf^",
        waypoints: [],
        withinTolerance: false,
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByTestId("map").first()).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "いい道を見つけたぞ。ただ、ちょっと長めになっちまった",
  );
  // 所要時間は 2800m ÷ 80m/分 = 35分（Routes API の 2000秒≒33分 ではない）
  await expect(page.getByTestId("route-summary")).toHaveText(
    "ルート 2.8 km・約35分",
  );
});
