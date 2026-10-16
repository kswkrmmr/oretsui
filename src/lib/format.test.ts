import { describe, expect, it } from "vitest";
import { formatDistance } from "./format";

describe("formatDistance", () => {
  it("1km未満はメートルで表示する", () => {
    expect(formatDistance(850)).toBe("850 m");
  });

  it("1km以上はキロメートルで小数1桁まで表示する", () => {
    expect(formatDistance(1234)).toBe("1.2 km");
  });
});
