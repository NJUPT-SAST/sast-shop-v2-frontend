import { describe, expect, it } from "vitest"
import { resolvePullGestureAxis } from "./pull-gesture"

describe("resolvePullGestureAxis", () => {
  it("waits until the gesture moves beyond the direction threshold", () => {
    expect(resolvePullGestureAxis(4, 5)).toBe("undetermined")
  })

  it("locks a mostly horizontal gesture to horizontal scrolling", () => {
    expect(resolvePullGestureAxis(18, 6)).toBe("horizontal")
    expect(resolvePullGestureAxis(-18, 6)).toBe("horizontal")
  })

  it("locks a mostly vertical gesture to pull-to-refresh", () => {
    expect(resolvePullGestureAxis(5, 18)).toBe("vertical")
  })
})
