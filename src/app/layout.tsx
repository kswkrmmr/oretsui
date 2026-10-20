import type { Metadata, Viewport } from "next";
import { APPLE_TOUCH_ICON, THEME_COLOR } from "@/lib/app-icon";
import "./globals.css";

export const metadata: Metadata = {
  title: "俺についてこい",
  description: "散歩ルートを自動で決めてくれるアプリ",
  // iPhone の Safari でホーム画面に追加したときの設定（#11）
  appleWebApp: {
    capable: true,
    title: "俺つい",
    statusBarStyle: "default",
  },
  icons: { apple: APPLE_TOUCH_ICON },
  // Next.js は mobile-web-app-capable しか出さないので、古い iPhone 用に apple- 版も出す
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
