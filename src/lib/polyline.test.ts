import { describe, expect, it } from "vitest";
import { decodePolyline } from "./polyline";

describe("decodePolyline", () => {
  it("Google のエンコード済みポリラインを緯度・経度の列に戻す", () => {
    // Google のドキュメントにある例
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toHaveLength(3);
    const expected = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    points.forEach((point, i) => {
      expect(point.lat).toBeCloseTo(expected[i].lat, 5);
      expect(point.lng).toBeCloseTo(expected[i].lng, 5);
    });
  });

  it("空の文字列なら空の列を返す", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
