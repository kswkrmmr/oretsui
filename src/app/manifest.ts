import type { MetadataRoute } from "next";
import { APP_ICONS, THEME_COLOR } from "@/lib/app-icon";
import { iconUrl } from "@/lib/icon-url";

/** ホーム画面に追加したとき、アプリのように全画面で開くための設定（#11） */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "俺についてこい",
    short_name: "俺つい",
    description: "散歩ルートを自動で決めてくれるアプリ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: THEME_COLOR,
    background_color: "#ffffff",
    lang: "ja",
    // apple-touch-icon は iPhone がメタタグから読むので、manifest には入れない
    icons: APP_ICONS.filter(({ file }) => file !== "apple-touch-icon.png").map(
      ({ file, size, purpose }) => ({
        // 画像を差し替えたら URL も変わるよう、版を付ける（#86）
        src: iconUrl(file),
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      }),
    ),
  };
}
