import { describe, expect, it } from "vitest";
import { initialStartPointState, startPointReducer } from "./start-point";

const HERE = { lat: 35.6895, lng: 139.6917 };
const TAPPED = { lat: 35.7, lng: 139.7 };

describe("startPointReducer", () => {
  it("現在地が取れたら、出発点が現在地になり、中心を現在地に移す", () => {
    const state = startPointReducer(initialStartPointState, {
      type: "located",
      position: HERE,
    });
    expect(state.current).toEqual(HERE);
    expect(state.locationStatus).toBe("available");
    expect(state.start).toEqual({ position: HERE, source: "current" });
    expect(state.centerRequest?.position).toEqual(HERE);
    expect(state.showNotice).toBe(false);
  });

  it("現在地が取れなかったら、案内を表示する", () => {
    const state = startPointReducer(initialStartPointState, {
      type: "locationFailed",
    });
    expect(state.locationStatus).toBe("unavailable");
    expect(state.showNotice).toBe(true);
    expect(state.start).toBeNull();
  });

  it("位置情報が使えないとき、タップした場所が出発点になり、案内が消える", () => {
    const failed = startPointReducer(initialStartPointState, {
      type: "locationFailed",
    });
    const state = startPointReducer(failed, {
      type: "mapTap",
      position: TAPPED,
    });
    expect(state.start).toEqual({ position: TAPPED, source: "manual" });
    expect(state.showNotice).toBe(false);
  });

  it("現在地が取れているとき、通常のタップでは出発点が変わらない", () => {
    const located = startPointReducer(initialStartPointState, {
      type: "located",
      position: HERE,
    });
    const state = startPointReducer(located, {
      type: "mapTap",
      position: TAPPED,
    });
    expect(state.start).toEqual({ position: HERE, source: "current" });
  });

  it("現在地の取得中は、タップしても出発点が変わらない", () => {
    const state = startPointReducer(initialStartPointState, {
      type: "mapTap",
      position: TAPPED,
    });
    expect(state.start).toBeNull();
  });

  it("現在地が取れていても、長押しした場所が出発点になる", () => {
    const located = startPointReducer(initialStartPointState, {
      type: "located",
      position: HERE,
    });
    const state = startPointReducer(located, {
      type: "mapLongPress",
      position: TAPPED,
    });
    expect(state.start).toEqual({ position: TAPPED, source: "manual" });
    expect(state.current).toEqual(HERE);
  });

  it("位置情報が使えないときも、長押しした場所が出発点になり、案内が消える", () => {
    const failed = startPointReducer(initialStartPointState, {
      type: "locationFailed",
    });
    const state = startPointReducer(failed, {
      type: "mapLongPress",
      position: TAPPED,
    });
    expect(state.start).toEqual({ position: TAPPED, source: "manual" });
    expect(state.showNotice).toBe(false);
  });

  it("現在地に戻ると、中心を現在地に移す依頼が新しく作られる（出発点は変えない）", () => {
    const located = startPointReducer(initialStartPointState, {
      type: "located",
      position: HERE,
    });
    const moved = startPointReducer(located, {
      type: "mapLongPress",
      position: TAPPED,
    });
    const state = startPointReducer(moved, { type: "recenter" });
    expect(state.centerRequest?.position).toEqual(HERE);
    expect(state.centerRequest?.id).not.toBe(located.centerRequest?.id);
    expect(state.start).toEqual({ position: TAPPED, source: "manual" });
  });

  it("現在地がないときに現在地に戻っても、何も変わらない", () => {
    const failed = startPointReducer(initialStartPointState, {
      type: "locationFailed",
    });
    expect(startPointReducer(failed, { type: "recenter" })).toBe(failed);
  });
});
