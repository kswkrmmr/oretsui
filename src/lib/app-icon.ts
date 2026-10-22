/** アプリのテーマカラー（ルートの線と同じ緑） */
export const THEME_COLOR = "#16a34a";

/** ホーム画面用のアイコン（#11）。中身は public/aniki/icon.png を縮小したもの（#84） */
export type AppIcon = {
  file: string;
  size: number;
  /** maskable は Android が丸や角丸に切り抜くので、印を小さめにして余白をとる */
  purpose: "any" | "maskable";
};

export const APP_ICONS: AppIcon[] = [
  { file: "icon-192.png", size: 192, purpose: "any" },
  { file: "icon-512.png", size: 512, purpose: "any" },
  { file: "maskable-512.png", size: 512, purpose: "maskable" },
  // iPhone のホーム画面用（apple-touch-icon）
  { file: "apple-touch-icon.png", size: 180, purpose: "any" },
];

export const APPLE_TOUCH_ICON = "/icons/apple-touch-icon.png";
