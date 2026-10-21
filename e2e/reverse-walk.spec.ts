import { expect, test, type Page } from "@playwright/test";

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

const HERE = { latitude: 35.6895, longitude: 139.6917 };
// 出発点から北へ約300m → 東へ約300m → 南へ約300m → 西へ出発点に戻る正方形。
// 順回りは北へ、逆回りは東へ歩き出す
const SQUARE_ROUTE = {
  distanceMeters: 1200,
  durationSeconds: 900,
  encodedPolyline: "kryxEcprsY{O??sSzO??rS",
  waypoints: [],
  withinTolerance: true,
};
// 北緯35.69度付近で、東へ m 進んだ経度
const eastOf = (m: number) => HERE.longitude + m / 90_300;

test.beforeEach(async ({ page, context }) => {
  // テストで本物の Google Maps を読み込まない
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  await page.route("**/api/route", (route) =>
    route.fulfill({ json: SQUARE_ROUTE }),
  );
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(HERE);
});

test("出発して逆向きに歩くと、歩いた距離が増え、兄貴が切り替えの一言を言う", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await page.getByRole("button", { name: "出発" }).click();
  const progress = page.getByTestId("walk-progress");
  await expect(progress).toHaveText(/^歩いた 0 m/);

  // 順回り（北）ではなく、東へ 45m 歩き出す（逆向き 40m 以上・順向き 10m 未満で切り替わる）
  await context.setGeolocation({ ...HERE, longitude: eastOf(45) });
  await expect(progress).toHaveText(/^歩いた 4\d m/);
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "そっちか！ならこっちだ、俺についてこい！",
  );

  // 逆回りのまま、さらに東へ進むと歩いた距離も増え続ける
  await context.setGeolocation({ ...HERE, longitude: eastOf(100) });
  await expect(progress).toHaveText(/^歩いた (9\d|10\d) m/);
});
