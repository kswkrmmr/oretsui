import Image from "next/image";
import { useState } from "react";
import {
  anikiFace,
  anikiFaceSrc,
  pickLine,
  type AnikiScene,
} from "@/lib/aniki";

/**
 * 兄貴の顔と吹き出し（#41）。顔は場面に合わせて表情を変える（#47）。
 * セリフは場面が変わったとき（または talkId が変わったとき）に1回だけ選び、
 * 次の場面まで同じセリフを出す（#92）。位置が届いて描き直しても変えない
 */
export function Aniki({
  scene,
  talkId = 0,
}: {
  scene: AnikiScene;
  /** 散歩中の一言の番号。同じ場面をもう一度言うときにセリフを選び直す */
  talkId?: number;
}) {
  const key = `${scene}:${talkId}`;
  const [said, setSaid] = useState(() => ({
    key,
    line: pickLine(scene, null, Math.random),
  }));
  let line = said.line;
  if (said.key !== key) {
    // 描画中に前の状態から次の状態を決める（React の「前回の props から state を調整する」書き方）
    line = pickLine(scene, said.line, Math.random);
    setSaid({ key, line });
  }
  return (
    <div className="flex min-w-0 flex-1 items-end gap-2">
      {/* 背景は画像（normal・smile）の背景と同じクリーム色。透明な画像でも表情で背景が変わらないように */}
      <Image
        src={anikiFaceSrc(anikiFace(scene))}
        alt="兄貴"
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-full bg-[#f9f3e4] object-cover shadow-lg"
      />
      <p
        data-testid="aniki-line"
        aria-live="polite"
        className="relative min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm font-bold text-neutral-900 shadow-lg"
      >
        {line}
      </p>
    </div>
  );
}
