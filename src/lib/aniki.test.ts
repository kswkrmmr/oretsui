import { describe, expect, it } from "vitest";
import {
  ALMOST_M,
  ANIKI_LINES,
  anikiFace,
  anikiFaceSrc,
  anikiScene,
  EN_ROUTE_M,
  pickLine,
  reversedWalkTalk,
  routeFit,
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
  it("issue で決めた文言のまま。先頭は今までのセリフ、2つ目以降は #92 で足したもの", () => {
    expect(ANIKI_LINES).toEqual({
      ready: [
        "今日はどれくらい歩く？決めてくれたら、道は俺に任せな",
        "さあ、今日はどこを歩こうか。時間を決めてくれ",
        "散歩日和だな。どれくらい歩く？",
      ],
      searching: [
        "いい道を探してくる。ちょっと待ってな",
        "どの道がいいかな…ちょっと考えさせてくれ",
        "とっておきの道を探してるところだ",
      ],
      found: [
        "いい道を見つけたぞ。俺についてこい！",
        "よし、いい道があったぞ。行こうぜ",
        "今日はこの道でどうだ？",
      ],
      another: [
        "じゃあ、こっちの道はどうだ？",
        "こっちも悪くないぞ",
        "気分を変えて、この道はどうだ？",
      ],
      failed: [
        "すまん、道が見つからなかった。もう一回いいか？",
        "悪い、うまく道が引けなかった。もう一回頼む",
        "あれ、道が見つからないな…もう一回試してくれ",
      ],
      // 散歩中（#42）
      start: [
        "よし、行くぞ！俺についてこい！",
        "今日もいい散歩にしようぜ",
        "準備はいいか？出発だ！",
      ],
      // 道中（#92）
      enRoute: [
        "いいペースだな",
        "この道、なかなかいいだろ？",
        "まわりの景色も楽しもうぜ",
        "無理せず、自分のペースでいいからな",
        "水分はとってるか？",
        "いい感じだ。その調子で行こう",
      ],
      half: [
        "半分来たぞ。やるなー！",
        "折り返しだ。いいペースだぞ",
        "もう半分か。早いな！",
      ],
      almost: [
        "あと少しだ。最後まで一緒に行こう",
        "ゴールはもうすぐだぞ",
        "ラストスパートだ！",
      ],
      offRoute: [
        "おっと、そっちじゃないぞ。ルートに戻ろう",
        "おーい、道が違うぞ。こっちだ",
        "ちょっと待て、ルートから外れてるぞ",
      ],
      backOnRoute: [
        "そうそう、その調子！",
        "よし、戻ってきたな",
        "それでいい。俺についてこい",
      ],
      lost: [
        "今どこにいるか分からないな…位置情報を許可してくれるか？",
        "見失っちまった…位置情報を確かめてくれ",
      ],
      finished: [
        "おつかれ！いい散歩だったな",
        "よく歩いたな！また一緒に行こうぜ",
        "おつかれさん。ゆっくり休めよ",
      ],
      // 逆回りに切り替えたとき（#52）
      reversed: [
        "そっちか！ならこっちだ、俺についてこい！",
        "逆から行くのか。いいぜ、付き合うぞ",
      ],
      // ルートの長さが目標の ±10% に入らなかったとき（#72）
      longer: [
        "いい道を見つけたぞ。ただ、ちょっと長めになっちまった",
        "ちょっと遠回りの道になったが、歩きがいがあるぞ",
      ],
      shorter: [
        "いい道を見つけたぞ。ただ、ちょっと短めになっちまった",
        "ちょっと短めだが、軽く歩くにはちょうどいいぞ",
      ],
    });
  });
});

describe("pickLine（#92）", () => {
  it("乱数を固定すると、決まったセリフを選ぶ", () => {
    expect(pickLine("half", null, () => 0)).toBe("半分来たぞ。やるなー！");
    expect(pickLine("half", null, () => 0.5)).toBe(
      "折り返しだ。いいペースだぞ",
    );
    expect(pickLine("half", null, () => 0.99)).toBe("もう半分か。早いな！");
  });

  it("前回と同じセリフは続けて選ばない", () => {
    const first = ANIKI_LINES.enRoute[0];
    for (const value of [0, 0.3, 0.6, 0.99])
      expect(pickLine("enRoute", first, () => value)).not.toBe(first);
    // 残りの候補の先頭を選ぶ
    expect(pickLine("enRoute", first, () => 0)).toBe(ANIKI_LINES.enRoute[1]);
  });

  it("前回が別の場面のセリフなら、すべての候補から選ぶ", () => {
    expect(pickLine("found", ANIKI_LINES.searching[0], () => 0)).toBe(
      ANIKI_LINES.found[0],
    );
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
      // 「半分」から 200m 歩いたら道中の一言（#92）
    ).toEqual(["start", "start", "half", "enRoute", "almost"]);
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

describe("道中の一言（#92）", () => {
  const TOTAL = 3000;
  function talk(updates: { walked: number; offRouteCount?: number }[]) {
    let current: WalkTalk = startWalkTalk();
    const said = [{ scene: current.scene, id: current.id }];
    for (const { walked, offRouteCount = 0 } of updates) {
      current = nextWalkTalk(current, { walked, total: TOTAL, offRouteCount });
      said.push({ scene: current.scene, id: current.id });
    }
    return said;
  }

  it(`最後に一言を言ってから ${EN_ROUTE_M}m 歩くと道中の一言になり、さらに ${EN_ROUTE_M}m ごとに言い直す`, () => {
    expect(
      talk([
        { walked: 150 },
        { walked: 200 },
        { walked: 350 },
        { walked: 400 },
      ]),
    ).toEqual([
      { scene: "start", id: 0 },
      { scene: "start", id: 0 },
      { scene: "enRoute", id: 1 },
      { scene: "enRoute", id: 1 },
      // 同じ道中でも番号が進むので、セリフを選び直す
      { scene: "enRoute", id: 2 },
    ]);
  });

  it("半分・外れた・戻ったのあとも、そこから数え直す", () => {
    const scenes = talk([
      { walked: 1500 },
      { walked: 1650 },
      { walked: 1700 },
      { walked: 1750, offRouteCount: 2 },
      { walked: 1900 },
      { walked: 2050 },
      { walked: 2100 },
    ]).map(({ scene }) => scene);
    expect(scenes).toEqual([
      "start",
      "half",
      "half",
      "enRoute",
      "offRoute",
      "backOnRoute",
      "backOnRoute",
      "enRoute",
    ]);
  });

  it(`外れてから ${EN_ROUTE_M}m 以上歩いて戻っても、道中ではなく「戻った」を言う`, () => {
    const scenes = talk([
      { walked: 100, offRouteCount: 2 },
      { walked: 400 },
    ]).map(({ scene }) => scene);
    expect(scenes).toEqual(["start", "offRoute", "backOnRoute"]);
  });

  it("外れている間は、位置が届いても一言を言い直さない", () => {
    const said = talk([
      { walked: 100, offRouteCount: 2 },
      { walked: 400, offRouteCount: 3 },
      { walked: 700, offRouteCount: 4 },
    ]);
    expect(said.slice(1)).toEqual([
      { scene: "offRoute", id: 1 },
      { scene: "offRoute", id: 1 },
      { scene: "offRoute", id: 1 },
    ]);
  });

  it("「あと少し」のあとは、道中の一言にならない", () => {
    const scenes = talk([
      { walked: 2700 },
      { walked: 2900 },
      { walked: 3000 },
    ]).map(({ scene }) => scene);
    expect(scenes).toEqual(["start", "almost", "almost", "almost"]);
  });

  it("逆回りに切り替えたら、逆回りの距離から数え直す", () => {
    let current = nextWalkTalk(startWalkTalk(), {
      walked: 180,
      total: TOTAL,
      offRouteCount: 0,
    });
    // 逆回りでは歩いた距離が測り直されて小さくなる
    current = reversedWalkTalk(current, 40);
    expect(current).toMatchObject({ scene: "reversed", id: 1, saidAt: 40 });
    current = nextWalkTalk(current, {
      walked: 200,
      total: TOTAL,
      offRouteCount: 0,
    });
    expect(current.scene).toBe("reversed");
    current = nextWalkTalk(current, {
      walked: 240,
      total: TOTAL,
      offRouteCount: 0,
    });
    expect(current).toMatchObject({ scene: "enRoute", id: 2 });
  });

  it("道中の表情は笑顔", () => {
    expect(anikiFace("enRoute")).toBe("smile");
  });
});

describe("兄貴の表情（#47）", () => {
  it("12の場面すべてに、issue で決めた表情が選ばれる", () => {
    expect({
      ready: anikiFace("ready"),
      searching: anikiFace("searching"),
      another: anikiFace("another"),
      found: anikiFace("found"),
      start: anikiFace("start"),
      half: anikiFace("half"),
      backOnRoute: anikiFace("backOnRoute"),
      finished: anikiFace("finished"),
      almost: anikiFace("almost"),
      failed: anikiFace("failed"),
      offRoute: anikiFace("offRoute"),
      lost: anikiFace("lost"),
    }).toEqual({
      ready: "normal",
      searching: "normal",
      another: "normal",
      found: "smile",
      start: "smile",
      half: "smile",
      backOnRoute: "smile",
      finished: "smile",
      almost: "fired-up",
      failed: "troubled",
      offRoute: "troubled",
      lost: "troubled",
    });
  });

  it("表情ごとの画像は public/aniki/ に置いたファイル", () => {
    expect(anikiFaceSrc("normal")).toBe("/aniki/normal.png");
    expect(anikiFaceSrc("smile")).toBe("/aniki/smile.png");
    expect(anikiFaceSrc("fired-up")).toBe("/aniki/fired-up.png");
    expect(anikiFaceSrc("troubled")).toBe("/aniki/troubled.png");
  });
});

describe("逆回りに切り替えたときの一言（#52）", () => {
  it("issue で決めたセリフと、燃えている表情", () => {
    expect(ANIKI_LINES.reversed[0]).toBe(
      "そっちか！ならこっちだ、俺についてこい！",
    );
    expect(anikiFace("reversed")).toBe("fired-up");
  });
});

describe("ルートの長さが目標とずれたとき（#72）", () => {
  it("±10% に入っていれば ok、入っていなければ長い・短いを距離で決める", () => {
    expect(
      routeFit({ withinTolerance: true, distanceMeters: 2800 }, 2400),
    ).toBe("ok");
    expect(
      routeFit({ withinTolerance: false, distanceMeters: 2800 }, 2400),
    ).toBe("longer");
    expect(
      routeFit({ withinTolerance: false, distanceMeters: 2000 }, 2400),
    ).toBe("shorter");
  });

  it("ずれたときは「長め」「短め」の場面になる（別のルートでも）", () => {
    const base: AnikiInput = {
      hasStart: true,
      routeStatus: "done",
      another: false,
      fit: "longer",
    };
    expect(anikiScene(base)).toBe("longer");
    expect(anikiScene({ ...base, fit: "shorter" })).toBe("shorter");
    expect(anikiScene({ ...base, another: true })).toBe("longer");
  });

  it("ずれていなければ、今までどおりの場面", () => {
    const base: AnikiInput = {
      hasStart: true,
      routeStatus: "done",
      another: false,
      fit: "ok",
    };
    expect(anikiScene(base)).toBe("found");
    expect(anikiScene({ ...base, another: true })).toBe("another");
  });

  it("表情は troubled", () => {
    expect(anikiFace("longer")).toBe("troubled");
    expect(anikiFace("shorter")).toBe("troubled");
  });
});
