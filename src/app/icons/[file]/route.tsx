import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { APP_ICONS } from "@/lib/app-icon";

// ビルド時に PNG を書き出す
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return APP_ICONS.map(({ file }) => ({ file }));
}

/** 人間が用意した兄貴のアイコン用の画像（正方形、透明なし）（#84） */
const SOURCE = path.join(process.cwd(), "public", "aniki", "icon.png");

/**
 * ホーム画面のアイコン。兄貴の画像全体を、それぞれの大きさに縮小する（#84）。
 * maskable も画像全体を使う（Android が丸く切り抜いても、顔は中央寄りなので残る）
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const icon = APP_ICONS.find((candidate) => candidate.file === file);
  if (!icon) return new Response("Not Found", { status: 404 });

  const source = `data:image/png;base64,${(await readFile(SOURCE)).toString("base64")}`;
  const { size } = icon;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundImage: `url(${source})`,
        backgroundSize: "100% 100%",
      }}
    />,
    { width: size, height: size },
  );
}
