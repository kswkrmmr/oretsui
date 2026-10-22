/** メートルを「1.2 km」「850 m」のような表示用文字列にする */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** 秒を「25分」「1時間5分」のような表示用文字列にする（最短でも「1分」） */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
}

/** 散歩の経過時間を「12:34」（1時間以上は「1:02:03」）のような表示用文字列にする（#68） */
export function formatElapsed(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
