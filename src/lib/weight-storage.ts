/** 体重の入力をスマホの中に保存するときのキー（#89）。サーバーには送らない */
export const WEIGHT_KEY = "oretsui:weight";

/** 保存した体重の入力を読み出す。保存していない・使えないときは空 */
export function loadWeightInput(): string {
  try {
    return localStorage.getItem(WEIGHT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 体重の入力を保存する。空なら消す。保存できない環境（プライベートブラウズなど）では何もしない */
export function saveWeightInput(input: string): void {
  try {
    if (input === "") localStorage.removeItem(WEIGHT_KEY);
    else localStorage.setItem(WEIGHT_KEY, input);
  } catch {
    // その回だけ使う
  }
}
