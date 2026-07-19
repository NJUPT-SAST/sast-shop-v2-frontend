import { describe, expect, it } from "vitest";
import { resolvePullGestureAxis, shouldRefreshAfterPull } from "./pull-gesture";

describe("resolvePullGestureAxis", () => {
  it("waits until the gesture moves beyond the direction threshold", () => {
    expect(resolvePullGestureAxis(4, 5)).toBe("undetermined");
  });

  it("locks a mostly horizontal gesture to horizontal scrolling", () => {
    expect(resolvePullGestureAxis(18, 6)).toBe("horizontal");
    expect(resolvePullGestureAxis(-18, 6)).toBe("horizontal");
  });

  it("locks a mostly vertical gesture to pull-to-refresh", () => {
    expect(resolvePullGestureAxis(5, 18)).toBe("vertical");
  });
});

describe("shouldRefreshAfterPull", () => {
  it("refreshes only after a completed pull reaches the threshold", () => {
    expect(shouldRefreshAfterPull(51, false)).toBe(false);
    expect(shouldRefreshAfterPull(52, false)).toBe(true);
  });

  it("never refreshes a cancelled touch gesture", () => {
    expect(shouldRefreshAfterPull(72, true)).toBe(false);
  });
});
