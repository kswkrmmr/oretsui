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
  | "half"
  | "almost"
  | "offRoute"
  | "backOnRoute"
  | "lost"
  | "finished"
  // 逆向きに歩き出して、逆回りに切り替えたとき（#52）
  | "reversed";

/** 場面ごとのセリフ。文言は issue #41・#42 で人間と決めたもの */
export const ANIKI_LINES: Record<AnikiScene, string> = {
  ready: "今日はどれくらい歩く？決めてくれたら、道は俺に任せな",
  searching: "いい道を探してくる。ちょっと待ってな",
  found: "いい道を見つけたぞ。俺についてこい！",
  another: "じゃあ、こっちの道はどうだ？",
  failed: "すまん、道が見つからなかった。もう一回いいか？",
  start: "よし、行くぞ！俺についてこい！",
  half: "半分来たぞ。やるなー！",
  almost: "あと少しだ。最後まで一緒に行こう",
  offRoute: "おっと、そっちじゃないぞ。ルートに戻ろう",
  backOnRoute: "そうそう、その調子！",
  lost: "今どこにいるか分からないな…位置情報を許可してくれるか？",
  finished: "おつかれ！いい散歩だったな",
  reversed: "そっちか！ならこっちだ、俺についてこい！",
};

/**
 * 場面のセリフ。ルートができたとき（found）は、最初に進む方角を入れて言う（#50）。
 * 方角が分からなければ ANIKI_LINES のまま
 */
export function anikiLine(scene: AnikiScene, direction: string | null): string {
  if (scene === "found" && direction)
    return `いい道を見つけたぞ。まずは${direction}へ行くぞ、俺についてこい！`;
  return ANIKI_LINES[scene];
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
  half: "smile",
  backOnRoute: "smile",
  finished: "smile",
  almost: "fired-up",
  reversed: "fired-up",
  failed: "troubled",
  offRoute: "troubled",
  lost: "troubled",
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
};

/** アプリの状態から場面を決める。出発点が決まるまでは兄貴を出さない（null） */
export function anikiScene({
  hasStart,
  routeStatus,
  another,
}: AnikiInput): AnikiScene | null {
  if (!hasStart) return null;
  switch (routeStatus) {
    case "idle":
      return "ready";
    case "loading":
      return "searching";
    case "done":
      return another ? "another" : "found";
    case "error":
      return "failed";
  }
}

/** 残りがこの距離（m）以下になったら「あと少し」と言う */
export const ALMOST_M = 300;

/** 散歩中の兄貴の一言と、もう言ったことの記録（#42） */
export type WalkTalk = {
  scene: AnikiScene;
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
    saidHalf: false,
    saidAlmost: false,
    offRoute: false,
  };
}

/**
 * 位置が届くたびに、次の一言を決める。外れているときはほかより優先する。
 * 言うことがなければ、前の一言のまま
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
    return { ...previous, scene: "offRoute", offRoute: true };
  if (previous.offRoute)
    return { ...previous, scene: "backOnRoute", offRoute: false };
  // 短いルートで両方に当たるときは「あと少し」を言い、「半分」はもう言わない
  if (!previous.saidAlmost && total - walked <= ALMOST_M)
    return { ...previous, scene: "almost", saidAlmost: true, saidHalf: true };
  if (!previous.saidHalf && walked >= total / 2)
    return { ...previous, scene: "half", saidHalf: true };
  return previous;
}
