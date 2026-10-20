/**
 * 兄貴の顔と吹き出し（#41）。顔は仮の SVG。
 * 差し替えるときは AnikiFace を画像（<img>）に置き換えればよい
 */
export function Aniki({ line }: { line: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-end gap-2">
      <AnikiFace />
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

/** 仮の顔。短髪・太い眉・にっと笑う口 */
function AnikiFace() {
  return (
    <svg
      role="img"
      aria-label="兄貴"
      viewBox="0 0 48 48"
      className="h-12 w-12 shrink-0 rounded-full bg-green-600 shadow-lg"
    >
      <circle cx="24" cy="27" r="15" fill="#f5c9a0" />
      <path
        d="M9 24c0-11 7-16 15-16s15 5 15 16c-3-5-8-7-15-7S12 19 9 24z"
        fill="#1f2937"
      />
      <path
        d="M15 22l6 1M33 22l-6 1"
        stroke="#1f2937"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="19" cy="27" r="1.6" fill="#1f2937" />
      <circle cx="29" cy="27" r="1.6" fill="#1f2937" />
      <path
        d="M18 33c3 3 9 3 12 0"
        stroke="#1f2937"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
