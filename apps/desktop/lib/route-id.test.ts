import { describe, expect, it } from "vitest"

import { parsePositiveInt64RouteId } from "./route-id"

describe("parsePositiveInt64RouteId", () => {
  it("accepts canonical signed int64 route ids", () => {
    expect(parsePositiveInt64RouteId("9223372036854775807")).toBe(
      "9223372036854775807",
    )
  })

  it.each(["", "0", "01", "-1", "1.2", "abc", "9223372036854775808"])(
    "rejects invalid route id %s",
    (value) => {
      expect(parsePositiveInt64RouteId(value)).toBeNull()
    },
  )
})
