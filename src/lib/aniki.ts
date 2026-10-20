import type { LoopRouteState } from "@/hooks/useLoopRoute";

/**
 * 兄貴（アプリ名「俺についてこい」の「俺」）が一言かける場面（#41）。
 * 散歩中の場面は #42 で足す
 */
export type AnikiScene = "ready" | "searching" | "found" | "another" | "failed";

/** 場面ごとのセリフ。文言は issue #41 で人間と決めたもの */
export const ANIKI_LINES: Record<AnikiScene, string> = {
  ready: "今日はどれくらい歩く？決めてくれたら、道は俺に任せな",
  searching: "いい道を探してくる。ちょっと待ってな",
  found: "いい道を見つけたぞ。俺についてこい！",
  another: "じゃあ、こっちの道はどうだ？",
  failed: "すまん、道が見つからなかった。もう一回いいか？",
};

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
