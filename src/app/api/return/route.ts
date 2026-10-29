import { computeWalkingRouteTo } from "@/lib/routes-api";
import type { LatLng } from "@/lib/start-point";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** 緯度・経度として正しければ LatLng にする。不正なら null */
function parseLatLng(value: unknown): LatLng | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  if (!isNumber(lat) || Math.abs(lat) > 90) return null;
  if (!isNumber(lng) || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status });

/** 今いる場所（from）から出発点（to）までの、帰り道の徒歩ルートを作る（#93） */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const from = parseLatLng(body?.from);
  const to = parseLatLng(body?.to);
  if (!from || !to) return error("リクエストの内容が正しくありません", 400);

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return error("ルート検索のキーが設定されていません", 500);

  try {
    const route = await computeWalkingRouteTo(apiKey, from, to);
    if (!route) return error("帰り道が見つかりませんでした", 502);
    return Response.json(route);
  } catch (e) {
    console.error(e);
    return error("ルート検索に失敗しました", 502);
  }
}
