import type { LoopRouteState } from "@/hooks/useLoopRoute";
import { isOffRoute } from "@/lib/walk-progress";

/** 兄貴（アプリ名「俺についてこい」の「俺」）が一言かける場面。ルートを作るまで（#41）と散歩中（#42） */
export type AnikiScene =
  | "ready"
  | "searching"
  | "found"
  | "another"
  | "failed"
  | "start"
  // 最後にセリフが変わってから、しばらく歩いたとき（#92）
  | "enRoute"
  | "half"
  | "almost"
  | "offRoute"
  | "backOnRoute"
  | "lost"
  | "finished"
  // 逆向きに歩き出して、逆回りに切り替えたとき（#52）
  | "reversed"
  // ルートの長さが目標の ±10% に入らなかったとき（#72）
  | "longer"
  | "shorter"
  // 途中で切り上げて帰るとき（#93）。帰り道を探している・作れなかった・できた
  | "homewardSearching"
  | "homewardFailed"
  | "homeward";

/**
 * 場面ごとのセリフ。先頭は issue #41・#42 などで人間と決めたもの。
 * 2つ目以降は #92 で足したもの。場面が変わるたびに、この中から1つ選ぶ
 */
export const ANIKI_LINES: Record<AnikiScene, readonly string[]> = {
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
  start: [
    "よし、行くぞ！俺についてこい！",
    "今日もいい散歩にしようぜ",
    "準備はいいか？出発だ！",
  ],
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
  reversed: [
    "そっちか！ならこっちだ、俺についてこい！",
    "逆から行くのか。いいぜ、付き合うぞ",
  ],
  longer: [
    "いい道を見つけたぞ。ただ、ちょっと長めになっちまった",
    "ちょっと遠回りの道になったが、歩きがいがあるぞ",
  ],
  shorter: [
    "いい道を見つけたぞ。ただ、ちょっと短めになっちまった",
    "ちょっと短めだが、軽く歩くにはちょうどいいぞ",
  ],
  homewardSearching: ["近道を探してくる。ちょっと待ってな"],
  homewardFailed: ["すまん、帰り道が見つからなかった。もう一回いいか？"],
  homeward: ["今日はここまでにしとくか。帰り道は任せな"],
};

/**
 * 場面のセリフから1つ選ぶ（#92）。前回と同じセリフは続けて選ばない。
 * random は 0 以上 1 未満を返す関数（テストで固定できるよう引数で渡す）
 */
export function pickLine(
  scene: AnikiScene,
  previous: string | null,
  random: () => number,
): string {
  const lines = ANIKI_LINES[scene];
  const candidates =
    lines.length > 1 ? lines.filter((line) => line !== previous) : lines;
  return candidates[Math.floor(random() * candidates.length)];
}

/** 兄貴の表情（#47）。画像は人間が用意したもの（#46） */
export type AnikiFace = "normal" | "smile" | "fired-up" | "troubled";

/** 場面ごとの表情。対応は issue #47 で人間と決めたもの */
const ANIKI_FACES: Record<AnikiScene, AnikiFace> = {
  ready: "normal",
  searching: "normal",
  another: "normal",
  found: "smile",
  start: "smile",
  enRoute: "smile",
  half: "smile",
  backOnRoute: "smile",
  finished: "smile",
  almost: "fired-up",
  reversed: "fired-up",
  failed: "troubled",
  offRoute: "troubled",
  lost: "troubled",
  longer: "troubled",
  shorter: "troubled",
  homewardSearching: "normal",
  homewardFailed: "troubled",
  homeward: "smile",
};

export function anikiFace(scene: AnikiScene): AnikiFace {
  return ANIKI_FACES[scene];
}

/** 表情の画像の場所（public/aniki/） */
export function anikiFaceSrc(face: AnikiFace): string {
  return `/aniki/${face}.png`;
}

export type AnikiInput = {
  /** 出発点が決まっているか */
  hasStart: boolean;
  routeStatus: LoopRouteState["status"];
  /** 最後のルート作りが「別のルート」だったか */
  another: boolean;
  /** ルートの長さが目標に合っているか（#72）。省略したら ok */
  fit?: RouteFit;
};

/** ルートの長さが目標の ±10% に入ったか。入らなかったら長い・短いのどちらか（#72） */
export type RouteFit = "ok" | "longer" | "shorter";

export function routeFit(
  route: { withinTolerance: boolean; distanceMeters: number },
  targetMeters: number,
): RouteFit {
  if (route.withinTolerance) return "ok";
  return route.distanceMeters > targetMeters ? "longer" : "shorter";
}

/** アプリの状態から場面を決める。出発点が決まるまでは兄貴を出さない（null） */
export function anikiScene({
  hasStart,
  routeStatus,
  another,
  fit = "ok",
}: AnikiInput): AnikiScene | null {
  if (!hasStart) return null;
  switch (routeStatus) {
    case "idle":
      return "ready";
    case "loading":
      return "searching";
    case "done":
      // 長さがずれたときは「別のルート」でも同じように言う（#72）
      if (fit !== "ok") return fit;
      return another ? "another" : "found";
    case "error":
      return "failed";
  }
}

/** 残りがこの距離（m）以下になったら「あと少し」と言う */
export const ALMOST_M = 300;

/** 最後にセリフが変わってから、この距離（m）歩いたら道中の一言を言う（#92） */
export const EN_ROUTE_M = 200;

/** 散歩中の兄貴の一言と、もう言ったことの記録（#42） */
export type WalkTalk = {
  scene: AnikiScene;
  /** 一言ごとに増える番号（#92）。同じ場面をもう一度言うときも、セリフを選び直すため */
  id: number;
  /** 最後に一言を言ったときの、歩いた距離（m）（#92） */
  saidAt: number;
  /** 「半分」「あと少し」は1回の散歩で1回だけ言う */
  saidHalf: boolean;
  saidAlmost: boolean;
  /** 前回、外れていたか（戻ったら「その調子」と言うため） */
  offRoute: boolean;
};

/** 出発したときの一言 */
export function startWalkTalk(): WalkTalk {
  return {
    scene: "start",
    id: 0,
    saidAt: 0,
    saidHalf: false,
    saidAlmost: false,
    offRoute: false,
  };
}

/** 新しい一言を言う。番号を進め、言ったときの距離を覚える */
function say(
  previous: WalkTalk,
  scene: AnikiScene,
  walked: number,
  change: Partial<WalkTalk> = {},
): WalkTalk {
  return { ...previous, ...change, scene, id: previous.id + 1, saidAt: walked };
}

/** 逆回りに切り替えたときの一言（#52）。道中の一言までの距離は、逆回りの距離で数え直す（#92） */
export function reversedWalkTalk(previous: WalkTalk, walked: number): WalkTalk {
  return say(previous, "reversed", walked);
}

/**
 * 帰り道に入ったときの一言（#93）。帰り道の距離は 0 から数え直す。
 * 帰り道では「半分」は言わず、「あと少し」は帰り道の残りで言う
 */
export function homewardWalkTalk(previous: WalkTalk): WalkTalk {
  return say(previous, "homeward", 0, {
    saidHalf: true,
    saidAlmost: false,
    offRoute: false,
  });
}

/**
 * 位置が届くたびに、次の一言を決める。外れているときはほかより優先する。
 * 言うことがなければ前の一言のままだが、しばらく歩いたら道中の一言を言う（#92）
 */
export function nextWalkTalk(
  previous: WalkTalk,
  {
    walked,
    total,
    offRouteCount,
  }: { walked: number; total: number; offRouteCount: number },
): WalkTalk {
  if (isOffRoute(offRouteCount))
    // 外れている間は、同じ一言を言い続ける（位置が届くたびにセリフを変えない）
    return previous.offRoute
      ? previous
      : say(previous, "offRoute", walked, { offRoute: true });
  if (previous.offRoute)
    return say(previous, "backOnRoute", walked, { offRoute: false });
  // 短いルートで両方に当たるときは「あと少し」を言い、「半分」はもう言わない
  if (!previous.saidAlmost && total - walked <= ALMOST_M)
    return say(previous, "almost", walked, {
      saidAlmost: true,
      saidHalf: true,
    });
  if (!previous.saidHalf && walked >= total / 2)
    return say(previous, "half", walked, { saidHalf: true });
  // 「あと少し」のあとは、ゴールまで「あと少し」のまま
  if (!previous.saidAlmost && walked - previous.saidAt >= EN_ROUTE_M)
    return say(previous, "enRoute", walked);
  return previous;
}
