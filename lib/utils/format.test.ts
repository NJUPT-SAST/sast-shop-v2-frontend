import { describe, expect, it } from "vitest"
import { diffCountdown, formatPercent, formatPrice, shortenId, sumPrice } from "./format"

describe("formatPrice", () => {
  it("formats numeric strings as CNY", () => {
    expect(formatPrice("29.90")).toMatch(/29\.90/)
    expect(formatPrice("29.90")).toMatch(/¥|￥|CN¥/)
  })
  it("returns dash for nullish or invalid input", () => {
    expect(formatPrice(null)).toBe("—")
    expect(formatPrice(undefined)).toBe("—")
    expect(formatPrice("")).toBe("—")
    expect(formatPrice("not-a-number")).toBe("—")
  })
  it("accepts numbers", () => {
    expect(formatPrice(8)).toMatch(/8\.00/)
  })
})

describe("sumPrice", () => {
  it("adds string and number values, ignoring nulls", () => {
    expect(sumPrice("29.90", 8)).toBe("37.90")
    expect(sumPrice("29.90", null, undefined, "")).toBe("29.90")
  })
})

describe("formatPercent", () => {
  it("returns 0% on zero/negative totals", () => {
    expect(formatPercent(5, 0)).toBe("0%")
    expect(formatPercent(5, -1)).toBe("0%")
  })
  it("clamps to 0..100", () => {
    expect(formatPercent(150, 100)).toBe("100%")
    expect(formatPercent(-5, 100)).toBe("0%")
    expect(formatPercent(50, 100)).toBe("50%")
  })
})

describe("diffCountdown", () => {
  it("flags expired deadlines", () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(diffCountdown(past)).toEqual({ expired: true, text: "已截止" })
  })
  it("describes future deadlines", () => {
    const future = new Date(Date.now() + 86_400_000 * 2).toISOString()
    const r = diffCountdown(future)
    expect(r.expired).toBe(false)
    expect(r.text).toMatch(/剩余/)
  })
  it("returns dash for null", () => {
    expect(diffCountdown(null)).toEqual({ expired: false, text: "—" })
  })
})

describe("shortenId", () => {
  it("uppercases and truncates", () => {
    expect(shortenId("8a1d0c4e-6f2c", 8)).toBe("8A1D0C4E")
    expect(shortenId("abc")).toBe("abc")
  })
})
