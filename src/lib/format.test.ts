import { describe, expect, it } from "vitest";
import { formatDistance, formatDuration } from "./format";

describe("formatDistance", () => {
  it("1km未満はメートルで表示する", () => {
    expect(formatDistance(850)).toBe("850 m");
  });

  it("1km以上はキロメートルで小数1桁まで表示する", () => {
    expect(formatDistance(1234)).toBe("1.2 km");
  });
});

describe("formatDuration", () => {
  it("60分未満は分で表示する", () => {
    expect(formatDuration(25 * 60)).toBe("25分");
  });

  it("60分以上は時間と分で表示する", () => {
    expect(formatDuration(65 * 60)).toBe("1時間5分");
  });

  it("ちょうど1時間なら分を付けない", () => {
    expect(formatDuration(60 * 60)).toBe("1時間");
  });

  it("1分未満（0秒を含む）は1分と表示する", () => {
    expect(formatDuration(0)).toBe("1分");
    expect(formatDuration(20)).toBe("1分");
  });

  it("秒は四捨五入して分にする", () => {
    expect(formatDuration(89)).toBe("1分");
    expect(formatDuration(90)).toBe("2分");
  });
});
