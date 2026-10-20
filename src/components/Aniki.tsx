import Image from "next/image";
import {
  ANIKI_LINES,
  anikiFace,
  anikiFaceSrc,
  type AnikiScene,
} from "@/lib/aniki";

/** 兄貴の顔と吹き出し（#41）。顔は場面に合わせて表情を変える（#47） */
export function Aniki({ scene }: { scene: AnikiScene }) {
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
        {ANIKI_LINES[scene]}
      </p>
    </div>
  );
}
