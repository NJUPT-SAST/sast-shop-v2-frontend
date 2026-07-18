import { describe, expect, it } from "vitest";

import { isValidRouteId } from "./route-id";

describe("route id guards", () => {
  it("allows positive integer ids for dynamic routes", () => {
    expect(isValidRouteId("3001")).toBe(true);
    expect(isValidRouteId("9223372036854775807")).toBe(true);
  });

  it("rejects generated prose and unsafe ids", () => {
    expect(isValidRouteId("Systematically improve the problem daily.")).toBe(
      false,
    );
    expect(isValidRouteId("")).toBe(false);
    expect(isValidRouteId("0")).toBe(false);
    expect(isValidRouteId("9223372036854775808")).toBe(false);
    expect(isValidRouteId("../orders")).toBe(false);
  });
});
