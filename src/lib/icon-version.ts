import { createHash } from "node:crypto";

/**
 * アイコンの URL に付ける版（#86）。画像の中身のハッシュの先頭 8 文字。
 * アイコンは「1年間取りに行かない」設定で配っているので、画像を差し替えても URL が同じだと
 * スマホ（Android ではアプリを作る Google のサーバーも）が前の画像を使い続ける。
 * 中身から版を作れば、差し替えたときだけ URL が変わる
 */
export function iconVersion(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 8);
}
