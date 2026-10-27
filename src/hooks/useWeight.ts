"use client";

import { useEffect, useState } from "react";
import { parseWeight } from "@/lib/calories";
import { loadWeightInput, saveWeightInput } from "@/lib/weight-storage";

/**
 * 体重の入力（#89）。入力はそのまま保存し、計算には範囲内の整数だけを使う。
 * サーバーで描画するときは localStorage がないので、画面を出したあとに読み出す
 */
export function useWeight() {
  const [input, setInput] = useState("");
  useEffect(() => {
    setInput(loadWeightInput());
  }, []);
  const change = (next: string) => {
    setInput(next);
    saveWeightInput(next);
  };
  return { input, change, weight: parseWeight(input) };
}
