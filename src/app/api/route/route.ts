import { findLoopRoute } from "@/lib/loop-route";
import { computeWalkingRoute } from "@/lib/routes-api";
import type { LatLng } from "@/lib/start-point";

type RouteRequest = {
  start: LatLng;
  meters: number;
  rotation?: number;
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** リクエストの中身を確かめる。不正なら null */
function parseRequest(body: unknown): RouteRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { start, meters, rotation } = body as Record<string, unknown>;
  if (typeof start !== "object" || start === null) return null;
  const { lat, lng } = start as Record<string, unknown>;
  if (!isNumber(lat) || Math.abs(lat) > 90) return null;
  if (!isNumber(lng) || Math.abs(lng) > 180) return null;
  if (!isNumber(meters) || meters <= 0) return null;
  if (rotation !== undefined && !isNumber(rotation)) return null;
  return { start: { lat, lng }, meters, rotation };
}

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status });

/** 出発点に戻ってくる、目標距離に近い散歩ルートを作る */
export async function POST(request: Request) {
  const input = parseRequest(await request.json().catch(() => null));
  if (!input) return error("リクエストの内容が正しくありません", 400);

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return error("ルート検索のキーが設定されていません", 500);

  // 回転角を指定されなければ、毎回違うルートになるようランダムに決める
  const rotation = input.rotation ?? Math.random() * 360;
  try {
    const result = await findLoopRoute(
      input.start,
      input.meters,
      rotation,
      (start, waypoints) => computeWalkingRoute(apiKey, start, waypoints),
    );
    if (!result) return error("ルートが見つかりませんでした", 502);
    return Response.json({
      ...result.route,
      waypoints: result.waypoints,
      withinTolerance: result.withinTolerance,
    });
  } catch (e) {
    console.error(e);
    return error("ルート検索に失敗しました", 502);
  }
}
