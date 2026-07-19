import { describe, expect, it } from "vitest";

import { MAX_INT32_CENTS, parseYuanToCents } from "./parse-yuan-to-cents";

describe("parseYuanToCents", () => {
  it.each([
    ["0", 0],
    ["0.01", 1],
    ["12.3", 1_230],
    ["12.30", 1_230],
    ["21474836.47", MAX_INT32_CENTS],
  ])("parses %s without floating-point drift", (value, expected) => {
    expect(parseYuanToCents(value)).toBe(expected);
  });

  it.each([
    "",
    " ",
    "-1",
    "+1",
    "1.",
    ".1",
    "1.001",
    "1e3",
    "21474836.48",
    "99999999999999999999999999999999999999999999999999",
  ])("rejects invalid or out-of-range value %j", (value) => {
    expect(parseYuanToCents(value)).toBeNull();
  });
});
