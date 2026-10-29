import { finishWalk, moveDuringWalk, startWalk } from "./helpers";
import { expect, test, type Page, type Route } from "@playwright/test";

// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

/** 兄貴の顔の画像が、その表情のものか（next/image は URL をエンコードして渡す） */
const faceOf = (face: string) =>
  new RegExp(encodeURIComponent(`/aniki/${face}.png`));

// 道中の一言の候補（#92）。どれを言うかは、前回のセリフによって変わる
const EN_ROUTE_LINES = new RegExp(
  `^(${[
    "いいペースだな",
    "この道、なかなかいいだろ？",
    "まわりの景色も楽しもうぜ",
    "無理せず、自分のペースでいいからな",
    "水分はとってるか？",
    "いい感じだ。その調子で行こう",
  ].join("|")})$`,
);

const ROUTE = {
  distanceMeters: 2134,
  durationSeconds: 1620,
  encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  waypoints: [],
  withinTolerance: true,
};

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

test("出発点が決まる → ルートを作る → できる → 別のルート → 失敗、の順に兄貴のセリフが入れ替わる", async ({
  page,
}) => {
  // 返事を1回ずつ手で返す。1回目は成功、2回目は別のルートで成功、3回目は失敗
  const pending: Route[] = [];
  await page.route("**/api/route", (route) => {
    pending.push(route);
  });
  const respond = async (fulfill: (route: Route) => Promise<void>) => {
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    await fulfill(pending.shift()!);
  };
  const ok = (route: Route) => route.fulfill({ json: ROUTE });
  const fail = (route: Route) =>
    route.fulfill({ status: 502, json: { error: "ルート検索に失敗しました" } });

  await page.goto("/");
  const line = page.getByTestId("aniki-line");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await expect(line).toHaveText(
    "今日はどれくらい歩く？決めてくれたら、道は俺に任せな",
  );
  await expect(page.getByRole("img", { name: "兄貴" })).toBeVisible();

  await page.getByRole("button", { name: "ルートを作る" }).click();
  await expect(line).toHaveText("いい道を探してくる。ちょっと待ってな");
  await respond(ok);
  await expect(line).toHaveText("いい道を見つけたぞ。俺についてこい！");
  const face = page.getByRole("img", { name: "兄貴" });
  await expect(face).toHaveAttribute("src", faceOf("smile"));

  await page.getByRole("button", { name: "別のルート" }).click();
  await expect(line).toHaveText("いい道を探してくる。ちょっと待ってな");
  await respond(ok);
  await expect(line).toHaveText("じゃあ、こっちの道はどうだ？");
  await expect(face).toHaveAttribute("src", faceOf("normal"));

  await page.getByRole("button", { name: "別のルート" }).click();
  await respond(fail);
  await expect(line).toHaveText(
    "すまん、道が見つからなかった。もう一回いいか？",
  );
  await expect(face).toHaveAttribute("src", faceOf("troubled"));
  // 今ある表示はそのまま残る
  await expect(
    page.getByRole("region", { name: "散歩の条件" }).getByRole("alert"),
  ).toContainText("ルートを作れませんでした");
});

test("兄貴の顔の画像は4枚とも読み込める", async ({ page, request }) => {
  for (const face of ["normal", "smile", "fired-up", "troubled"]) {
    const response = await request.get(`/aniki/${face}.png`);
    expect(response.status(), face).toBe(200);
  }
  // 画面に出した顔も、縮めた画像が届いて表示できている
  await page.goto("/");
  const face = page.getByRole("img", { name: "兄貴" });
  await expect(face).toBeVisible();
  await expect
    .poll(() =>
      face.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
});

test("出発点が決まるまでは兄貴を出さない", async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("位置情報が使えません");
  await expect(page.getByTestId("aniki-line")).toHaveCount(0);
});

/** 2つの箱が重なっているか */
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

test("兄貴の吹き出しは「現在地に戻る」ボタンや条件のシートと重ならない", async ({
  page,
}) => {
  await page.route("**/api/route", (route) => route.fulfill({ json: ROUTE }));
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  const check = async () => {
    const bubble = await page.getByTestId("aniki-line").boundingBox();
    const face = await page.getByRole("img", { name: "兄貴" }).boundingBox();
    const recenter = await page
      .getByRole("button", { name: "現在地に戻る" })
      .boundingBox();
    const sheet = await page
      .getByRole("region", { name: "散歩の条件" })
      .boundingBox();
    for (const box of [bubble!, face!]) {
      expect(overlaps(box, recenter!)).toBe(false);
      expect(overlaps(box, sheet!)).toBe(false);
      // 画面の横からはみ出さない
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  };
  // 条件を出しているときと、ルートを作って条件を隠したときの両方
  await check();
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await expect(page.getByTestId("aniki-line")).toHaveText(
    "いい道を見つけたぞ。俺についてこい！",
  );
  await check();
});

test("散歩中、出発 → 道中 → 半分 → 道中 → 残り 300m → 外れる → 戻る → 終了 の順に兄貴のセリフが入れ替わる", async ({
  page,
  context,
}) => {
  // 出発点から北へ約445m、東へ約452m、出発点へ戻る三角形（全長 約1.5km）
  await page.route("**/api/route", (route) =>
    route.fulfill({
      json: { ...ROUTE, encodedPolyline: "kryxEcprsY_X??g^~Wf^" },
    }),
  );
  await page.goto("/");
  await expect(mapContainer(page)).toHaveAttribute(
    "data-start-source",
    "current",
  );
  await page.getByRole("button", { name: "ルートを作る" }).click();
  await startWalk(page);
  const line = page.getByTestId("aniki-line");
  const progress = page.getByTestId("walk-progress");
  const moveTo = (latitude: number, longitude: number) =>
    moveDuringWalk(page, context, { latitude, longitude });

  await expect(line).toHaveText("よし、行くぞ！俺についてこい！");
  // 北へ進み、東の区間へ。進み具合は一度に 300m 先までしか探さないので、少しずつ動かす
  await moveTo(35.6915, 139.6917);
  await expect(progress).toContainText("歩いた 222 m");
  // 出発の一言から 200m 歩いたので、道中の一言になる（#92）。乱数を固定しているので先頭の候補
  await expect(line).toHaveText("いいペースだな");
  await moveTo(35.6935, 139.6917);
  await moveTo(35.6935, 139.694);
  // 位置の更新が届いたことを確かめてから次へ進む（約 650m）
  await expect(progress).toContainText(/歩いた 6[45]\d m/);
  // 半分の手前でも、出発の一言のままにはしない（#92）
  await expect(line).toHaveText(EN_ROUTE_LINES);
  await moveTo(35.6935, 139.6955);
  await expect(line).toHaveText("半分来たぞ。やるなー！");

  // 東の角から出発点へ戻る区間
  await moveTo(35.6935, 139.6967);
  await moveTo(35.6919, 139.6947);
  // 「半分」から 200m 以上歩いたので、道中の一言になる（#92）
  await expect(line).toHaveText(EN_ROUTE_LINES);
  await moveTo(35.69127, 139.69392);
  await expect(line).toHaveText("あと少しだ。最後まで一緒に行こう");
  await expect(page.getByRole("img", { name: "兄貴" })).toHaveAttribute(
    "src",
    faceOf("fired-up"),
  );

  // 西へ約 100m 外れた位置が2回続く
  await moveTo(35.69127, 139.69272);
  await moveTo(35.69128, 139.69272);
  await expect(line).toHaveText("おっと、そっちじゃないぞ。ルートに戻ろう");
  await moveTo(35.69127, 139.69392);
  await expect(line).toHaveText("そうそう、その調子！");

  await finishWalk(page);
  await expect(line).toHaveText("おつかれ！いい散歩だったな");
  // 次の操作で入れ替わる
  await page.getByRole("button", { name: "条件を変える" }).click();
  await expect(line).toHaveText("いい道を見つけたぞ。俺についてこい！");
});
