import { moveDuringWalk, startWalk } from "./helpers";
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
  await startWalk(page);
  const progress = page.getByTestId("walk-progress");
  await expect(progress).toHaveText(/^歩いた 0 m/);

  // 順回り（北）ではなく、東へ 45m 歩き出す（逆回りが順回りより 30m 以上多くなると切り替わる）
  await moveDuringWalk(page, context, { ...HERE, longitude: eastOf(45) });
  await expect(progress).toHaveText(/^歩いた 4\d m/);
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "そっちか！ならこっちだ、俺についてこい！",
  );

  // 逆回りのまま、さらに東へ進むと歩いた距離も増え続ける
  await moveDuringWalk(page, context, { ...HERE, longitude: eastOf(100) });
  await expect(progress).toHaveText(/^歩いた (9\d|10\d) m/);
});

test("最初の約20mを行きと帰りで共有するルートでも、角から逆回りの道へ進むと切り替わる（#60）", async ({
  page,
  context,
}) => {
  // 出発点から東へ約20m の角までは同じ道。角から順回りは北へ、逆回りは南へ
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: {
        ...SQUARE_ROUTE,
        encodedPolyline: "kryxEcprsY?k@{O??sSv`@??rS{O??j@",
      },
    }),
  );
  const corner = { latitude: HERE.latitude, longitude: 139.69192 };

  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  const progress = page.getByTestId("walk-progress");
  await expect(progress).toHaveText(/^歩いた 0 m/);

  // 同じ道を角まで歩く（まだどちら向きか分からないので切り替えない）
  await moveDuringWalk(page, context, corner);
  await expect(progress).toHaveText(/^歩いた (1\d|2\d) m/);
  await expect(page.getByTestId("aniki-line")).not.toHaveText(
    "そっちか！ならこっちだ、俺についてこい！",
  );

  // 角から南（逆回りの道）へ約35m
  await moveDuringWalk(page, context, {
    ...corner,
    latitude: corner.latitude - 35 / 111_195,
  });
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "そっちか！ならこっちだ、俺についてこい！",
  );
  await expect(progress).toHaveText(/^歩いた (4\d|5\d|6\d) m/);
});
