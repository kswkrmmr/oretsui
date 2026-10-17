import { describe, expect, it } from "vitest";
import {
  formatDistance,
  INITIAL_CONDITIONS,
  minutesToMeters,
  targetMeters,
} from "./walk-conditions";

describe("minutesToMeters", () => {
  it.each([
    ["slow", 30, 1800],
    ["normal", 30, 2400],
    ["fast", 30, 3000],
    ["normal", 15, 1200],
    ["fast", 60, 6000],
  ] as const)("%s で %i 分歩くと %i m になる", (speed, minutes, meters) => {
    expect(minutesToMeters(minutes, speed)).toBe(meters);
  });
});

describe("targetMeters", () => {
  it("時間モードでは、時間と歩く速さから距離を求める", () => {
    expect(
      targetMeters({
        ...INITIAL_CONDITIONS,
        mode: "time",
        minutes: 60,
        speed: "slow",
      }),
    ).toBe(3600);
  });

  it("距離モードでは、選んだ距離をそのまま使い、速さは関係ない", () => {
    expect(
      targetMeters({
        ...INITIAL_CONDITIONS,
        mode: "distance",
        meters: 5000,
        speed: "fast",
      }),
    ).toBe(5000);
  });

  it("初期値は時間モード・30分・ふつうで、2.4km になる", () => {
    expect(INITIAL_CONDITIONS).toMatchObject({
      mode: "time",
      minutes: 30,
      speed: "normal",
    });
    expect(targetMeters(INITIAL_CONDITIONS)).toBe(2400);
  });
});

describe("formatDistance", () => {
  it.each([
    [2400, "約2.4km"],
    [1000, "約1.0km"],
    [1250, "約1.3km"],
  ])("%i m は「%s」と表示する", (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });
});
