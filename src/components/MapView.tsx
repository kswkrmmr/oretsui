"use client";

import Image from "next/image";
import {
  AdvancedMarker,
  APIProvider,
  Map,
  Pin,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState } from "react";
import { Aniki } from "@/components/Aniki";
import { ConditionSheet } from "@/components/ConditionSheet";
import { useLoopRoute, type LoopRouteState } from "@/hooks/useLoopRoute";
import { useDeviceHeading } from "@/hooks/useDeviceHeading";
import { useStartPoint } from "@/hooks/useStartPoint";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWalk, type WalkRecord, type WalkState } from "@/hooks/useWalk";
import { useWeight } from "@/hooks/useWeight";
import { requestReturnRoute } from "@/lib/route-request";
import { closerAhead } from "@/lib/return-walk";
import { walkingCalories } from "@/lib/calories";
import { formatDistance, formatDuration, formatElapsed } from "@/lib/format";
import {
  LONG_PRESS_MS,
  movedTooFar,
  pixelToWorldPoint,
  type Point,
} from "@/lib/long-press";
import {
  anikiFace,
  anikiFaceSrc,
  anikiScene,
  routeFit,
  type AnikiScene,
} from "@/lib/aniki";
import { walkingSeconds, type WalkSpeed } from "@/lib/walk-conditions";
import { MAP_ID, MAP_OPTIONS } from "@/lib/map-config";
import { shouldRotate } from "@/lib/heading";
import { decodePolyline } from "@/lib/polyline";
import { anikiPosition } from "@/lib/route-direction";
import { isOffRoute } from "@/lib/walk-progress";
import type { LatLng, StartPointState } from "@/lib/start-point";

type Props = {
  apiKey: string;
};

/** 画面いっぱいに表示する地図 */
export function MapView({ apiKey }: Props) {
  const { state, tap, longPress, recenter } = useStartPoint();
  const { start } = state;
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  // 所要時間の計算に使う歩く速さ（#72）
  const [routeSpeed, setRouteSpeed] = useState<WalkSpeed>("normal");
  const { state: route, generate, retry, another } = useLoopRoute();
  // 消費カロリーの計算に使う体重（#89）
  const weight = useWeight();
  // ルートを作ったら条件を隠し、「条件を変える」で戻す。失敗したときは条件も見せる
  const [showConditions, setShowConditions] = useState(true);
  const collapsed =
    !showConditions && (route.status === "loading" || route.status === "done");
  const encodedPolyline =
    route.status === "done" ? route.route.encodedPolyline : "";
  const path = useMemo(
    () => decodePolyline(encodedPolyline),
    [encodedPolyline],
  );
  const walk = useWalk(path);
  const walking = walk.state.status !== "idle";
  const homeward = walk.state.status === "walking" ? walk.state.homeward : null;
  // 散歩中の地図の向き（#69）。出発したら「向いている方角が上」、ボタンで「北が上」と切り替える
  const [headingMode, setHeadingMode] = useState<"device" | "north">("device");
  const deviceHeading = useDeviceHeading(walking);
  const rotateMap =
    walking && headingMode === "device" && deviceHeading.status === "ok";
  // 方角が分からない（許可なし・センサーなし・届かない）ときは北を上にし、案内を出す。回せないので方位のボタンは出さない
  const headingUnavailable = walking && deviceHeading.status === "unavailable";
  const headingNotice = headingUnavailable && headingMode === "device";
  // 散歩中は画面をスリープさせない（#36）
  useWakeLock(walking);
  // 散歩中は地図を現在地に追従させる。指で地図を動かしたらやめ、「現在地に戻る」で再開する
  const [following, setFollowing] = useState(true);
  const walkPosition =
    walk.state.status === "walking" ? walk.state.position : null;
  const currentDot = walking ? walkPosition : state.current;
  // 兄貴の一言（#41）。「別のルート」で作ったかどうかで言い方を変える
  const [anotherRoute, setAnotherRoute] = useState(false);
  // 散歩を終えたら、次の操作まで「おつかれ」と言う（#42）
  // 終了したときの記録（#68）。まとめと「おつかれ」は、次の操作まで出しておく
  const [lastWalk, setLastWalk] = useState<WalkRecord | null>(null);
  const finished = lastWalk !== null;
  // 途中で切り上げて帰る（#93）。「終了」で出す選択肢と、帰り道を作っているかどうか
  const [endMenu, setEndMenu] = useState(false);
  const [homewardStatus, setHomewardStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  // 元のルートの残りのほうが近いとき、選んでもらうまで取っておく帰り道（#96）
  const [pendingHome, setPendingHome] = useState<LatLng[] | null>(null);
  const goHome = async () => {
    const from = walkPosition ?? state.current;
    setEndMenu(false);
    if (!from || !start) return setHomewardStatus("error");
    setHomewardStatus("loading");
    try {
      const route = await requestReturnRoute(from, start.position);
      const homePath = decodePolyline(route.encodedPolyline);
      if (closerAhead(walk.total - walk.activeWalked, route.distanceMeters))
        setPendingHome(homePath);
      else walk.goHome(homePath);
      setHomewardStatus("idle");
    } catch {
      setHomewardStatus("error");
    }
  };
  const scene: AnikiScene | null =
    walk.state.status === "walking"
      ? pendingHome
        ? "closerAhead"
        : homewardStatus === "loading"
          ? "homewardSearching"
          : homewardStatus === "error"
            ? "homewardFailed"
            : walk.state.talk.scene
      : walk.state.status === "unavailable"
        ? "lost"
        : finished && route.status === "done"
          ? "finished"
          : anikiScene({
              hasStart: start !== null,
              routeStatus: route.status,
              another: anotherRoute,
              fit:
                route.status === "done" && routeDistance !== null
                  ? routeFit(route.route, routeDistance)
                  : "ok",
            });

  // 地図の外からも出発点と生成の依頼を確かめられるよう、入れ物に出す（E2E 用）
  const startAttributes = start
    ? {
        "data-start-lat": start.position.lat,
        "data-start-lng": start.position.lng,
        "data-start-source": start.source,
      }
    : {};
  // 兄貴は地図の上で、自分がルート上で歩いた距離の少し先にいる（#51）
  const aniki = anikiPosition(walk.activePath, walk.activeWalked);
  const anikiAttributes = aniki
    ? { "data-aniki-lat": aniki.lat, "data-aniki-lng": aniki.lng }
    : {};
  // 散歩中に位置の更新を受け取った回数（#66）。E2E で、位置を動かしたら更新が届くまで待つために使う
  const walkAttributes =
    walk.state.status === "walking"
      ? { "data-walk-updates": walk.state.updates }
      : {};
  // 地図の向きの設定（#69、E2E 用）。散歩中だけ出す
  // 地図の向きのモード（#69、E2E 用）。方角が分からないときは北が上（north）
  const headingAttributes = walking
    ? { "data-heading-mode": headingUnavailable ? "north" : headingMode }
    : {};
  const routeAttributes =
    routeDistance === null ? {} : { "data-route-distance": routeDistance };

  const onMapEvent =
    (handler: typeof tap) =>
    ({ detail }: MapMouseEvent) => {
      if (detail.latLng) handler(detail.latLng);
    };

  return (
    <div
      data-testid="map"
      className="fixed inset-0 h-dvh w-full"
      {...startAttributes}
      {...routeAttributes}
      {...anikiAttributes}
      {...walkAttributes}
      {...headingAttributes}
    >
      {apiKey ? (
        <>
          <APIProvider apiKey={apiKey}>
            <Map
              {...MAP_OPTIONS}
              mapId={MAP_ID}
              className="h-full w-full"
              onClick={onMapEvent(tap)}
              // PC の右クリックと Android の長押し用（iOS の長押しは LongPressHandler で受ける）
              onContextmenu={onMapEvent(longPress)}
              onDragstart={() => setFollowing(false)}
            >
              <CenterController request={state.centerRequest} />
              <HeadingController
                heading={rotateMap ? deviceHeading.heading : null}
              />
              <LongPressHandler onLongPress={longPress} />
              {following && <FollowController position={walkPosition} />}
              {currentDot && (
                <AdvancedMarker position={currentDot} title="現在地">
                  <div
                    data-testid="current-location-dot"
                    className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow"
                  />
                </AdvancedMarker>
              )}
              {start && (
                <AdvancedMarker position={start.position} title="出発点">
                  <Pin />
                </AdvancedMarker>
              )}
              {path.length > 0 && (
                // 帰っているときは帰り道の線にする（#93）
                <RouteLine
                  path={homeward ? walk.activePath : path}
                  reversed={walk.reversed}
                />
              )}
              {aniki && (
                <AdvancedMarker position={aniki} title="兄貴" zIndex={10}>
                  <Image
                    data-testid="aniki-marker"
                    src={anikiFaceSrc(anikiFace(scene ?? "found"))}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border-2 border-white bg-[#f9f3e4] object-cover shadow-lg"
                  />
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
          {state.showNotice && (
            <p
              role="status"
              className="pointer-events-none absolute top-[calc(max(0.5rem,env(safe-area-inset-top))+2.5rem)] right-4 left-4 rounded-lg bg-white/90 px-3 py-2 text-center text-sm text-neutral-900 shadow"
            >
              位置情報が使えません。地図をタップして出発点を選んでください
            </p>
          )}
          {/* 片手で届く画面下部に、条件のシートと、そのすぐ上に兄貴の一言と「現在地に戻る」を置く */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-end gap-3">
            <div className="flex w-full items-end gap-3 px-4">
              {scene ? (
                <div className="pointer-events-auto flex min-w-0 flex-1">
                  <Aniki
                    scene={scene}
                    talkId={
                      walk.state.status === "walking" ? walk.state.talk.id : 0
                    }
                  />
                </div>
              ) : (
                <div className="flex-1" />
              )}
              {walking && !headingUnavailable && (
                <button
                  type="button"
                  aria-label={
                    headingMode === "device"
                      ? "北を上にする"
                      : "向いている方角を上にする"
                  }
                  onClick={() =>
                    setHeadingMode((mode) =>
                      mode === "device" ? "north" : "device",
                    )
                  }
                  className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-lg active:bg-neutral-100"
                >
                  {/* 北の印。地図を回しているときは、地図の北の向きに合わせて回す */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    style={{
                      transform: `rotate(${rotateMap ? -(deviceHeading.heading ?? 0) : 0}deg)`,
                    }}
                  >
                    <path d="M12 2l4 10h-8z" className="fill-red-600" />
                    <path d="M12 22l-4-10h8z" className="fill-neutral-400" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                aria-label="現在地に戻る"
                onClick={walking ? () => setFollowing(true) : recenter}
                className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-lg active:bg-neutral-100"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </button>
            </div>
            <div className="pointer-events-auto w-full">
              <ConditionSheet
                disabled={!start}
                collapsed={collapsed}
                status={
                  <RouteStatus
                    state={route}
                    collapsed={collapsed}
                    walk={walk.state}
                    remaining={walk.total - walk.activeWalked}
                    homeward={homeward !== null}
                    endMenu={endMenu}
                    homewardFailed={homewardStatus === "error"}
                    closerAhead={pendingHome !== null}
                    onKeepGoing={() => setPendingHome(null)}
                    onGoHomeAnyway={() => {
                      if (pendingHome) walk.goHome(pendingHome);
                      setPendingHome(null);
                    }}
                    speed={routeSpeed}
                    weight={weight.weight}
                    startedAt={walk.startedAt}
                    headingNotice={headingNotice}
                    lastWalk={
                      finished && route.status === "done" ? lastWalk : null
                    }
                    onStartWalk={() => {
                      setLastWalk(null);
                      setFollowing(true);
                      setHeadingMode("device");
                      // iPhone はタップの直後でないと方角の許可を求められない（#69）
                      void deviceHeading.requestPermission();
                      walk.start();
                    }}
                    onStopWalk={() => {
                      setEndMenu(false);
                      setPendingHome(null);
                      setHomewardStatus("idle");
                      setLastWalk(walk.stop());
                    }}
                    onOpenEndMenu={() => setEndMenu(true)}
                    onCloseEndMenu={() => setEndMenu(false)}
                    onGoHome={() => void goHome()}
                    onRetry={() => {
                      setShowConditions(false);
                      retry();
                    }}
                    onAnother={() => {
                      setLastWalk(null);
                      setAnotherRoute(true);
                      another();
                    }}
                    onEditConditions={() => {
                      setLastWalk(null);
                      setShowConditions(true);
                    }}
                  />
                }
                weightInput={weight.input}
                onWeightChange={weight.change}
                onGenerate={(meters, speed) => {
                  setRouteSpeed(speed);
                  setLastWalk(null);
                  setAnotherRoute(false);
                  setRouteDistance(meters);
                  setShowConditions(false);
                  if (start) void generate(start.position, meters);
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-4">
          <p role="alert" className="text-center text-sm">
            Google Maps の API キーが設定されていません
          </p>
        </div>
      )}
    </div>
  );
}

// ルート全体を収めるときの余白（px）。下は条件のシートに隠れない分をあける
const ROUTE_PADDING = { top: 64, right: 32, bottom: 320, left: 32 };

/** 作ったルートを地図に線で描き、ルート全体が画面に収まるようにズームする */
/**
 * 進む向きの矢印（#50）。画面上の間隔で並べるので、ズームしても詰まらない。
 * 逆回りのときは逆向きの矢印にする（#52）
 */
function arrowIcons(reversed: boolean): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: reversed
          ? google.maps.SymbolPath.BACKWARD_CLOSED_ARROW
          : google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 3,
        strokeColor: "#ffffff",
        strokeWeight: 1,
        fillColor: "#ffffff",
        fillOpacity: 1,
      },
      repeat: "80px",
    },
  ];
}

function RouteLine({ path, reversed }: { path: LatLng[]; reversed: boolean }) {
  const map = useMap();
  const lineRef = useRef<google.maps.Polyline | null>(null);
  useEffect(() => {
    if (!map) return;
    const line = new google.maps.Polyline({
      path,
      map,
      strokeColor: "#16a34a",
      strokeOpacity: 0.9,
      strokeWeight: 6,
      icons: arrowIcons(false),
    });
    lineRef.current = line;
    const bounds = new google.maps.LatLngBounds();
    for (const point of path) bounds.extend(point);
    map.fitBounds(bounds, ROUTE_PADDING);
    return () => {
      line.setMap(null);
      lineRef.current = null;
    };
  }, [map, path]);
  // 向きが変わったら矢印だけ差し替える（線を作り直すと、散歩中に地図がズームし直してしまう）
  useEffect(() => {
    lineRef.current?.setOptions({ icons: arrowIcons(reversed) });
  }, [reversed]);
  return null;
}

/**
 * シートの上部に出す、ルートの状態。条件を隠しているときは「別のルート」「条件を変える」「出発」も出す。
 * 散歩中は進み具合と「終了」。失敗したときはエラーと再試行ボタン
 */
function RouteStatus({
  state,
  collapsed,
  walk,
  remaining,
  homeward,
  endMenu,
  homewardFailed,
  closerAhead,
  onKeepGoing,
  onGoHomeAnyway,
  speed,
  weight,
  startedAt,
  headingNotice,
  lastWalk,
  onStartWalk,
  onStopWalk,
  onOpenEndMenu,
  onCloseEndMenu,
  onGoHome,
  onRetry,
  onAnother,
  onEditConditions,
}: {
  state: LoopRouteState;
  collapsed: boolean;
  walk: WalkState;
  /** 残りの距離（m）。帰っているときは帰り道の残り（#93） */
  remaining: number;
  homeward: boolean;
  /** 「終了」を押して、終わり方の選択肢を出しているか（#93） */
  endMenu: boolean;
  homewardFailed: boolean;
  /** 元のルートの残りのほうが近くて、このまま進むかを選んでもらっているか（#96） */
  closerAhead: boolean;
  onKeepGoing: () => void;
  onGoHomeAnyway: () => void;
  speed: WalkSpeed;
  weight: number | null;
  startedAt: number | null;
  headingNotice: boolean;
  lastWalk: WalkRecord | null;
  onStartWalk: () => void;
  onStopWalk: () => void;
  onOpenEndMenu: () => void;
  onCloseEndMenu: () => void;
  onGoHome: () => void;
  onRetry: () => void;
  onAnother: () => void;
  onEditConditions: () => void;
}) {
  if (walk.status !== "idle") {
    return (
      <>
        {walk.status === "walking" && isOffRoute(walk.offRouteCount) && (
          <p
            role="alert"
            className="rounded-lg bg-amber-100 py-2 text-center text-sm font-bold text-amber-900"
          >
            ルートから外れています
          </p>
        )}
        {headingNotice && (
          <p className="text-center text-xs text-neutral-600">
            向いている方角が分からないので、北を上にしています
          </p>
        )}
        {walk.status === "walking" ? (
          <p data-testid="walk-progress" className="text-center text-sm">
            歩いた{" "}
            <strong className="text-base">{formatDistance(walk.walked)}</strong>{" "}
            / {homeward ? "帰り道の残り" : "残り"}{" "}
            <strong className="text-base">{formatDistance(remaining)}</strong>
          </p>
        ) : (
          <p role="alert" className="text-center text-sm text-red-700">
            現在地を取得できません
          </p>
        )}
        {walk.status === "walking" && weight !== null && (
          <p data-testid="walk-calories" className="text-center text-sm">
            約{" "}
            <strong className="text-base">
              {walkingCalories(weight, walk.walked, speed)}
            </strong>{" "}
            kcal
          </p>
        )}
        {startedAt !== null && <WalkElapsed startedAt={startedAt} />}
        {homewardFailed && (
          <div className="flex items-center gap-3">
            <p role="alert" className="flex-1 text-sm text-red-700">
              帰り道を作れませんでした
            </p>
            <button
              type="button"
              onClick={onGoHome}
              className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-700 active:bg-red-50"
            >
              再試行
            </button>
          </div>
        )}
        {closerAhead ? (
          <>
            <WalkButton onClick={onKeepGoing}>このまま進む</WalkButton>
            <WalkButton onClick={onGoHomeAnyway}>
              それでも帰り道にする
            </WalkButton>
          </>
        ) : endMenu ? (
          // 終わり方を選ぶ（#93）。帰っているときは「出発点まで帰る」を出さない
          <>
            <WalkButton onClick={onStopWalk}>ここで終わる</WalkButton>
            {walk.status === "walking" && !homeward && (
              <WalkButton onClick={onGoHome}>出発点まで帰る</WalkButton>
            )}
            <WalkButton onClick={onCloseEndMenu}>やめる</WalkButton>
          </>
        ) : (
          <WalkButton onClick={onOpenEndMenu}>終了</WalkButton>
        )}
      </>
    );
  }
  if (state.status === "loading" && collapsed) {
    return (
      <p role="status" className="py-3 text-center text-sm">
        ルートを作成中…
      </p>
    );
  }
  if (state.status === "done") {
    const summary = (
      <p data-testid="route-summary" className="text-center text-sm">
        ルート{" "}
        <strong className="text-base">
          {formatDistance(state.route.distanceMeters)}
        </strong>
        ・約
        <strong className="text-base">
          {/* Routes API の時間ではなく、選んだ歩く速さで計算する（#72） */}
          {formatDuration(walkingSeconds(state.route.distanceMeters, speed))}
        </strong>
      </p>
    );
    // 体重を入れているときだけ、消費カロリーも出す（#89）
    const calories =
      lastWalk && walkingCalories(weight, lastWalk.meters, speed);
    const walkSummary = lastWalk && (
      <p data-testid="walk-summary" className="text-center text-sm font-bold">
        今日の散歩 {formatDuration(lastWalk.seconds)}・
        {formatDistance(lastWalk.meters)}
        {calories !== null && `・約 ${calories} kcal`}
      </p>
    );
    if (!collapsed)
      return (
        <>
          {walkSummary}
          {summary}
        </>
      );
    return (
      <>
        {walkSummary}
        {summary}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEditConditions}
            className="min-h-12 flex-1 rounded-xl border border-neutral-300 font-bold text-neutral-700 active:bg-neutral-100"
          >
            条件を変える
          </button>
          <button
            type="button"
            onClick={onAnother}
            className="min-h-12 flex-1 rounded-xl bg-green-600 font-bold text-white active:bg-green-700"
          >
            別のルート
          </button>
        </div>
        <button
          type="button"
          onClick={onStartWalk}
          // 歩きながらでも押しやすいよう、横幅いっぱい・高さ 56px（#79）
          className="min-h-14 w-full rounded-xl bg-blue-600 font-bold text-white active:bg-blue-700"
        >
          出発
        </button>
      </>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex items-center gap-3">
        <p role="alert" className="flex-1 text-sm text-red-700">
          ルートを作れませんでした
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-700 active:bg-red-50"
        >
          再試行
        </button>
      </div>
    );
  }
  return null;
}

/** 散歩中のボタン。歩きながらでも押しやすいよう、横幅いっぱい・高さ 56px（#79） */
function WalkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-14 w-full rounded-xl border border-neutral-300 font-bold text-neutral-700 active:bg-neutral-100"
    >
      {children}
    </button>
  );
}

/** 散歩中、現在地が変わるたびに地図の中心を現在地へ移す */
function FollowController({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && position) map.panTo(position);
  }, [map, position]);
  return null;
}

/** 中心を移す依頼が来るたびに、地図の中心を移す（ズームは変えない） */
function CenterController({
  request,
}: {
  request: StartPointState["centerRequest"];
}) {
  const map = useMap();
  useEffect(() => {
    if (map && request) map.panTo(request.position);
  }, [map, request]);
  return null;
}

/**
 * 指での長押しを判定する。iOS は長押しで contextmenu を出さないため、
 * 指が触れてから動かさずに押し続けたかを自前で見る
 */
function LongPressHandler({
  onLongPress,
}: {
  onLongPress: (position: LatLng) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const div = map.getDiv();
    const touching = new Set<number>();
    let start: Point | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cancel = () => {
      clearTimeout(timer);
      start = null;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touching.add(e.pointerId);
      // 2本目の指が触れたらピンチなので取り消す
      if (touching.size > 1) return cancel();
      const pressed = { x: e.clientX, y: e.clientY };
      start = pressed;
      timer = setTimeout(() => {
        start = null;
        const position = pixelToLatLng(map, pressed);
        if (position) onLongPress(position);
      }, LONG_PRESS_MS);
    };
    const move = (e: PointerEvent) => {
      if (start && movedTooFar(start, { x: e.clientX, y: e.clientY })) cancel();
    };
    const up = (e: PointerEvent) => {
      touching.delete(e.pointerId);
      cancel();
    };

    // 地図が中で止めないよう、キャプチャ段階で受ける
    const listeners = [
      ["pointerdown", down],
      ["pointermove", move],
      ["pointerup", up],
      ["pointercancel", up],
    ] as const;
    for (const [type, listener] of listeners)
      div.addEventListener(type, listener, true);
    return () => {
      cancel();
      for (const [type, listener] of listeners)
        div.removeEventListener(type, listener, true);
    };
  }, [map, onLongPress]);
  return null;
}

/** 画面上の位置を、地図上の緯度・経度に変える */
function pixelToLatLng(map: google.maps.Map, client: Point): LatLng | null {
  const projection = map.getProjection();
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (!projection || !center || zoom === undefined) return null;
  const centerWorld = projection.fromLatLngToPoint(center);
  if (!centerWorld) return null;
  const rect = map.getDiv().getBoundingClientRect();
  const world = pixelToWorldPoint(centerWorld, zoom, rect, {
    x: client.x - rect.left,
    y: client.y - rect.top,
  });
  const latLng = projection.fromPointToLatLng(
    new google.maps.Point(world.x, world.y),
  );
  return latLng ? { lat: latLng.lat(), lng: latLng.lng() } : null;
}

/** 散歩の経過時間（#68）。1秒ごとに表示を更新する */
function WalkElapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p data-testid="walk-elapsed" className="text-center text-sm">
      経過{" "}
      <strong className="text-base tabular-nums">
        {formatElapsed(Math.max(0, now - startedAt) / 1000)}
      </strong>
    </p>
  );
}

/**
 * 地図の向きを変える（#69）。heading が null なら北を上（0°）にする。
 * ふらつきを抑えるため、前回回したときから 5° 以上変わったときだけ回す
 */
function HeadingController({ heading }: { heading: number | null }) {
  const map = useMap();
  const applied = useRef(0);
  useEffect(() => {
    if (!map) return;
    const target = heading ?? 0;
    if (heading === null) {
      if (applied.current !== 0) map.setHeading(0);
      applied.current = 0;
      return;
    }
    if (shouldRotate(applied.current, target)) {
      map.setHeading(target);
      applied.current = target;
    }
  }, [map, heading]);
  return null;
}
