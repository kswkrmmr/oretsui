/**
 * 周回ルートの円の向き（回転角、度）を決める。
 * 乱数（0 以上 1 未満）は引数で受け取り、テストで固定できるようにする
 */

/** 最初に作るルートの回転角。0〜360° のランダム */
export function initialRotation(random: number): number {
  return random * 360;
}

/**
 * 「別のルート」の回転角。ほぼ同じルートにならないよう、
 * 前の回転角から 90〜270° の範囲でずらす
 */
export function nextRotation(previous: number, random: number): number {
  return (previous + 90 + random * 180) % 360;
}
