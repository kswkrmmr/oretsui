import { describe, expect, it } from "vitest";
import {
  ALMOST_M,
  ANIKI_LINES,
  anikiScene,
  nextWalkTalk,
  startWalkTalk,
  type AnikiInput,
  type WalkTalk,
} from "./aniki";

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
      // 散歩中（#42）
      start: "よし、行くぞ！俺についてこい！",
      half: "半分来たぞ。やるなー！",
      almost: "あと少しだ。最後まで一緒に行こう",
      offRoute: "おっと、そっちじゃないぞ。ルートに戻ろう",
      backOnRoute: "そうそう、その調子！",
      lost: "今どこにいるか分からないな…位置情報を許可してくれるか？",
      finished: "おつかれ！いい散歩だったな",
    });
  });
});

describe("散歩中の一言", () => {
  const TOTAL = 2000;
  /** 位置が届いた順に一言を決め、場面の並びを返す */
  function talk(
    updates: { walked: number; offRouteCount?: number }[],
    total = TOTAL,
  ) {
    let current: WalkTalk = startWalkTalk();
    const scenes = [current.scene];
    for (const { walked, offRouteCount = 0 } of updates) {
      current = nextWalkTalk(current, { walked, total, offRouteCount });
      scenes.push(current.scene);
    }
    return scenes;
  }

  it("出発 → 半分 → あと少し の順に言い、言うことがなければ前の一言のまま", () => {
    expect(
      talk([
        { walked: 100 },
        { walked: 1000 },
        { walked: 1200 },
        { walked: 1700 },
      ]),
    ).toEqual(["start", "start", "half", "half", "almost"]);
  });

  it(`「半分」と「あと少し（残り ${ALMOST_M}m）」は1回の散歩で1回だけ`, () => {
    const scenes = talk([
      { walked: 1000 },
      { walked: 1100, offRouteCount: 2 },
      { walked: 1100 },
      { walked: 1800 },
      { walked: 1800, offRouteCount: 2 },
      { walked: 1900 },
    ]);
    expect(scenes.filter((scene) => scene === "half")).toHaveLength(1);
    expect(scenes.filter((scene) => scene === "almost")).toHaveLength(1);
  });

  it("外れている間はほかより優先し、戻ったら「その調子」と言う", () => {
    expect(
      talk([
        { walked: 100, offRouteCount: 1 },
        { walked: 100, offRouteCount: 2 },
        // 外れたまま半分を過ぎても「外れた」を言い続ける
        { walked: 1000, offRouteCount: 3 },
        { walked: 1000 },
        { walked: 1050 },
      ]),
    ).toEqual([
      "start",
      "start",
      "offRoute",
      "offRoute",
      "backOnRoute",
      "half",
    ]);
  });

  it("1回だけの外れ（2回続かない）では「外れた」と言わない", () => {
    expect(talk([{ walked: 100, offRouteCount: 1 }, { walked: 120 }])).toEqual([
      "start",
      "start",
      "start",
    ]);
  });

  it("短いルートで半分と残り 300m に同時に当たるときは「あと少し」だけを言う", () => {
    expect(talk([{ walked: 300 }, { walked: 400 }], 500)).toEqual([
      "start",
      "almost",
      "almost",
    ]);
  });
});
