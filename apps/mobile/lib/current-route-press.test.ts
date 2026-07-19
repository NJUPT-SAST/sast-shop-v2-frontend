import { describe, expect, it } from "vitest";
import { resolveCurrentRoutePress } from "./current-route-press";

describe("resolveCurrentRoutePress", () => {
  it("scrolls to the top when the current page has been scrolled", () => {
    expect(resolveCurrentRoutePress(120, false)).toBe("scroll-to-top");
  });

  it("refreshes when the current page is already at the top", () => {
    expect(resolveCurrentRoutePress(0, true)).toBe("refresh");
    expect(resolveCurrentRoutePress(2, true)).toBe("refresh");
  });
});
