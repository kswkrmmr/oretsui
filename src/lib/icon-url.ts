import { readFileSync } from "node:fs";
import path from "node:path";
import { iconVersion } from "@/lib/icon-version";

/** アイコンの元の画像（#84）。サーバー側（ビルド時）でだけ読む */
export const ICON_SOURCE = path.join(
  process.cwd(),
  "public",
  "aniki",
  "icon.png",
);

/** 元の画像の中身から作った版（#86） */
export const ICON_VERSION = iconVersion(readFileSync(ICON_SOURCE));

/** 版の付いたアイコンの URL（例：/icons/icon-192.png?v=3f2a9c1b） */
export function iconUrl(file: string): string {
  return `/icons/${file}?v=${ICON_VERSION}`;
}
