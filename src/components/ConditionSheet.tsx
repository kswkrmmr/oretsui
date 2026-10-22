"use client";

import { useState } from "react";
import {
  DISTANCE_PRESETS,
  durationSpeed,
  formatDistance,
  INITIAL_CONDITIONS,
  targetMeters,
  TIME_PRESETS,
  WALK_SPEEDS,
  type WalkConditions,
  type WalkSpeed,
} from "@/lib/walk-conditions";

type Props = {
  /** 出発点がないときは「ルートを作る」を押せなくする */
  disabled: boolean;
  /** 「ルートを作る」を押したときに、目標距離（m）と所要時間の計算に使う歩く速さ（#72）を渡して呼ぶ */
  onGenerate: (meters: number, speed: WalkSpeed) => void;
  /**
   * ルートを作成中・作成後は、条件と「ルートを作る」を隠して status だけを出す。
   * 隠しても選んだ条件は残る
   */
  collapsed?: boolean;
  /** シートの上部に出す、作ったルートの情報やエラー */
  status?: React.ReactNode;
};

/** 画面下の、散歩の条件を選ぶシート */
export function ConditionSheet({
  disabled,
  onGenerate,
  collapsed = false,
  status,
}: Props) {
  const [conditions, setConditions] = useState(INITIAL_CONDITIONS);
  const update = (change: Partial<WalkConditions>) =>
    setConditions((current) => ({ ...current, ...change }));
  const meters = targetMeters(conditions);

  return (
    <section
      aria-label="散歩の条件"
      className="w-full space-y-2 rounded-t-2xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-neutral-900 shadow-[0_-4px_16px_rgba(0,0,0,0.15)]"
    >
      {status}
      {!collapsed && (
        <>
          <ChoiceRow>
            <Choice
              label="時間"
              selected={conditions.mode === "time"}
              onSelect={() => update({ mode: "time" })}
            />
            <Choice
              label="距離"
              selected={conditions.mode === "distance"}
              onSelect={() => update({ mode: "distance" })}
            />
          </ChoiceRow>

          {conditions.mode === "time" ? (
            <>
              <ChoiceRow>
                {TIME_PRESETS.map((minutes) => (
                  <Choice
                    key={minutes}
                    label={`${minutes}分`}
                    selected={conditions.minutes === minutes}
                    onSelect={() => update({ minutes })}
                  />
                ))}
              </ChoiceRow>
              <ChoiceRow>
                {(Object.keys(WALK_SPEEDS) as WalkSpeed[]).map((speed) => (
                  <Choice
                    key={speed}
                    label={WALK_SPEEDS[speed].label}
                    selected={conditions.speed === speed}
                    onSelect={() => update({ speed })}
                  />
                ))}
              </ChoiceRow>
            </>
          ) : (
            <ChoiceRow>
              {DISTANCE_PRESETS.map((presetMeters) => (
                <Choice
                  key={presetMeters}
                  label={`${presetMeters / 1000}km`}
                  selected={conditions.meters === presetMeters}
                  onSelect={() => update({ meters: presetMeters })}
                />
              ))}
            </ChoiceRow>
          )}

          {/* シートを低く保ち地図を隠しすぎないよう、距離の表示とボタンを1行に並べる */}
          <div className="flex items-center gap-3">
            <p className="text-xs leading-tight">
              歩く距離
              <br />
              <strong className="text-base">{formatDistance(meters)}</strong>
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onGenerate(meters, durationSpeed(conditions))}
              className="min-h-12 flex-1 rounded-xl bg-green-600 font-bold text-white active:bg-green-700 disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              ルートを作る
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ChoiceRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

/** 選択肢のボタン。選ばれているものを aria-pressed で示す */
function Choice({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`min-h-11 flex-1 rounded-lg border text-sm font-bold ${
        selected
          ? "border-green-600 bg-green-50 text-green-700"
          : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}
