import { expect, type BrowserContext, type Page } from "@playwright/test";

// 散歩中の E2E で使う共通の手順（#66）。
// 位置を続けて動かすと、2回の移動が1回分として届くことがあり、テストが不安定になる。
// そこで、地図の入れ物に出している「位置の更新を受け取った回数」（data-walk-updates）が
// 増えるのを待ってから次へ進む

// @vis.gl/react-google-maps も内側の div に data-testid="map" を付けるため、
// 外側（DOM 上で先に出てくる）コンテナを明示的に指定する
const mapContainer = (page: Page) => page.getByTestId("map").first();

const walkUpdates = async (page: Page) =>
  Number(await mapContainer(page).getAttribute("data-walk-updates"));

/** 「出発」を押し、出発直後に届く最初の位置の更新を待つ */
export async function startWalk(page: Page) {
  await page.getByRole("button", { name: "出発" }).click();
  await expect(mapContainer(page)).toHaveAttribute("data-walk-updates", "1");
}

/** 散歩中に位置を動かし、その更新がアプリに届くまで待つ */
export async function moveDuringWalk(
  page: Page,
  context: BrowserContext,
  position: { latitude: number; longitude: number },
) {
  const before = await walkUpdates(page);
  await context.setGeolocation(position);
  await expect(mapContainer(page)).toHaveAttribute(
    "data-walk-updates",
    String(before + 1),
  );
}

/** 散歩を終える。「終了」で終わり方の選択肢が出るので、「ここで終わる」を選ぶ（#93） */
export async function finishWalk(page: Page) {
  await page.getByRole("button", { name: "終了" }).click();
  await page.getByRole("button", { name: "ここで終わる" }).click();
}
