import { describe, expect, it } from "vitest"
import { presaleListingSchema, secondhandListingSchema, voteFirstListingSchema } from "./listing"

const baseValid = {
  title: "校园周边",
  description: "测试商品",
  price: "29.90",
  image_urls: ["https://cdn.example.com/a.jpg"],
  shipping_mode: "free",
  payment_mode: "qr_code",
  qr_code_url: "https://cdn.example.com/qr.png",
  delivery_mode: "express",
  stock: 1,
}

describe("secondhandListingSchema", () => {
  it("accepts minimum valid input", () => {
    const r = secondhandListingSchema.safeParse({ ...baseValid, type: "secondhand" })
    expect(r.success).toBe(true)
  })
  it("rejects missing title", () => {
    const r = secondhandListingSchema.safeParse({
      ...baseValid,
      type: "secondhand",
      title: "",
    })
    expect(r.success).toBe(false)
  })
  it("rejects malformed price", () => {
    const r = secondhandListingSchema.safeParse({
      ...baseValid,
      type: "secondhand",
      price: "abc",
    })
    expect(r.success).toBe(false)
  })
})

describe("voteFirstListingSchema", () => {
  it("requires variants and deadline", () => {
    const r = voteFirstListingSchema.safeParse({
      ...baseValid,
      type: "crowdfund",
      cf_mode: "vote_first",
      target_votes: 50,
      deadline: "2026-06-01T00:00:00Z",
      variants: [],
    })
    expect(r.success).toBe(false)
  })
  it("accepts a complete vote-first listing", () => {
    const r = voteFirstListingSchema.safeParse({
      ...baseValid,
      type: "crowdfund",
      cf_mode: "vote_first",
      target_votes: 50,
      deadline: "2026-06-01T00:00:00Z",
      show_vote_count: true,
      vote_weight_strategy: "equal",
      variants: [
        {
          name: "黑色",
          max_votes_per_user: 1,
          designs: [{ name: "方案 A", image_url: "https://cdn.example.com/a.jpg" }],
        },
      ],
    })
    expect(r.success).toBe(true)
  })
})

describe("presaleListingSchema", () => {
  it("requires sub_merchant payment_mode", () => {
    const r = presaleListingSchema.safeParse({
      ...baseValid,
      type: "crowdfund",
      cf_mode: "presale",
      target_amount: "10000.00",
      deadline: "2026-06-01T00:00:00Z",
      payment_mode: "qr_code", // invalid for presale
    })
    expect(r.success).toBe(false)
  })
  it("accepts a valid presale listing", () => {
    const r = presaleListingSchema.safeParse({
      ...baseValid,
      type: "crowdfund",
      cf_mode: "presale",
      target_amount: "10000.00",
      deadline: "2026-06-01T00:00:00Z",
      payment_mode: "sub_merchant",
    })
    expect(r.success).toBe(true)
  })
})
