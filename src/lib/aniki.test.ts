import { describe, expect, it } from "vitest";
import { ANIKI_LINES, anikiScene, type AnikiInput } from "./aniki";

const input = (overrides: Partial<AnikiInput>): AnikiInput => ({
  hasStart: true,
  routeStatus: "idle",
  another: false,
  ...overrides,
});

describe("anikiScene", () => {
  it("出発点が決まるまでは兄貴を出さない", () => {
    expect(anikiScene(input({ hasStart: false }))).toBeNull();
    expect(
      anikiScene(input({ hasStart: false, routeStatus: "loading" })),
    ).toBeNull();
  });

  it("出発点が決まってルートがまだなら、距離を決めるよう声をかける", () => {
    expect(anikiScene(input({}))).toBe("ready");
  });

  it("作成中・できた・作れなかったで場面が変わる", () => {
    expect(anikiScene(input({ routeStatus: "loading" }))).toBe("searching");
    expect(anikiScene(input({ routeStatus: "done" }))).toBe("found");
    expect(anikiScene(input({ routeStatus: "error" }))).toBe("failed");
  });

  it("「別のルート」でできたときは、別の道を勧める", () => {
    expect(anikiScene(input({ routeStatus: "done", another: true }))).toBe(
      "another",
    );
    // 作成中や失敗は、別のルートでも同じ場面
    expect(anikiScene(input({ routeStatus: "loading", another: true }))).toBe(
      "searching",
    );
    expect(anikiScene(input({ routeStatus: "error", another: true }))).toBe(
      "failed",
    );
  });
});

describe("ANIKI_LINES", () => {
  it("issue で決めた文言のまま", () => {
    expect(ANIKI_LINES).toEqual({
      ready: "今日はどれくらい歩く？決めてくれたら、道は俺に任せな",
      searching: "いい道を探してくる。ちょっと待ってな",
      found: "いい道を見つけたぞ。俺についてこい！",
      another: "じゃあ、こっちの道はどうだ？",
      failed: "すまん、道が見つからなかった。もう一回いいか？",
    });
  });
});
