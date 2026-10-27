import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWeightInput, saveWeightInput, WEIGHT_KEY } from "./weight-storage";

// Node 22 以降は組み込みの localStorage（保存先を指定しないと使えない）が jsdom のものより優先されるので、
// テストではメモリ上の localStorage に差し替える
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("体重の保存", () => {
  it("保存した入力を読み出せる", () => {
    saveWeightInput("65");
    expect(storage.getItem(WEIGHT_KEY)).toBe("65");
    expect(loadWeightInput()).toBe("65");
  });

  it("保存していなければ空", () => {
    expect(loadWeightInput()).toBe("");
  });

  it("空にしたら保存も消す", () => {
    saveWeightInput("65");
    saveWeightInput("");
    expect(storage.getItem(WEIGHT_KEY)).toBeNull();
  });

  it("localStorage が使えなくても壊れない", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });
    expect(loadWeightInput()).toBe("");
    expect(() => saveWeightInput("65")).not.toThrow();
  });
});
