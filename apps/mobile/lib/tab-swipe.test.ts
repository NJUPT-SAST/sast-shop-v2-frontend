import { describe, expect, it } from "vitest";
import { resolveTabSwipe } from "./tab-swipe";

describe("tab swipe", () => {
  it("ignores a tap without pointer movement", () => {
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 100, y: 100 })).toBeNull();
  });

  it("ignores small pointer jitter around a tap", () => {
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 108, y: 94 })).toBeNull();
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 93, y: 109 })).toBeNull();
  });

  it("resolves horizontal swipe direction", () => {
    expect(resolveTabSwipe({ x: 200, y: 100 }, { x: 100, y: 110 })).toBe(
      "next",
    );
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 200, y: 110 })).toBe(
      "previous",
    );
  });

  it("requires the horizontal distance threshold", () => {
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 45, y: 100 })).toBeNull();
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 44, y: 100 })).toBe(
      "next",
    );
  });

  it("ignores vertical scrolling and diagonally vertical gestures", () => {
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 104, y: 220 })).toBeNull();
    expect(resolveTabSwipe({ x: 100, y: 100 }, { x: 170, y: 180 })).toBeNull();
  });
});
