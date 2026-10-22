import { describe, expect, it } from "vitest";
import { iconVersion } from "./icon-version";

describe("iconVersion（#86：アイコンの URL に付ける版）", () => {
  const a = new TextEncoder().encode("兄貴の画像 A");
  const b = new TextEncoder().encode("兄貴の画像 B");

  it("同じ中身なら同じ版になる", () => {
    expect(iconVersion(a)).toBe(iconVersion(new Uint8Array(a)));
  });

  it("中身が違えば違う版になる", () => {
    expect(iconVersion(a)).not.toBe(iconVersion(b));
  });

  it("版は 16 進数 8 文字", () => {
    expect(iconVersion(a)).toMatch(/^[0-9a-f]{8}$/);
  });
});
