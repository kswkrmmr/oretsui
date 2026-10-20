import { ImageResponse } from "next/og";
import { APP_ICONS, THEME_COLOR } from "@/lib/app-icon";

// ビルド時に PNG を書き出す
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return APP_ICONS.map(({ file }) => ({ file }));
}

/** 仮のアイコン。緑の背景に、白で周回ルート（輪）と出発点（点）を描く */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const icon = APP_ICONS.find((candidate) => candidate.file === file);
  if (!icon) return new Response("Not Found", { status: 404 });

  const { size } = icon;
  // maskable は中央 80% だけが必ず見えるので、印を小さくする
  const ring = size * (icon.purpose === "maskable" ? 0.42 : 0.56);
  const stroke = ring * 0.14;
  const dot = ring * 0.3;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: THEME_COLOR,
      }}
    >
      <div
        style={{
          width: ring,
          height: ring,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          borderRadius: "50%",
          border: `${stroke}px solid white`,
        }}
      >
        <div
          style={{
            width: dot,
            height: dot,
            marginBottom: -(dot + stroke) / 2,
            borderRadius: "50%",
            background: "white",
            border: `${stroke * 0.6}px solid ${THEME_COLOR}`,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
