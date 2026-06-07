import type { Order } from "@/lib/api/types"
import { describe, expect, it } from "vitest"
import {
  getBuyerActions,
  getOrderProgressSteps,
  getOrderViewKey,
  getSellerActions,
} from "./order-state"

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: "o1",
    listing: {
      id: "l1",
      title: "Test",
      image_url: null,
      type: "secondhand",
      shipping_mode: "free",
    },
    buyer: { id: "b1", name: "Buyer", avatar_url: null },
    seller: { id: "s1", name: "Seller", avatar_url: null },
    status: "pending_payment",
    shipping_status: null,
    amount: "10.00",
    shipping_fee: null,
    quantity: 1,
    payment_method: null,
    payment_code: null,
    payment_qr_url: null,
    shipping_qr_url: null,
    payment_trade_no: null,
    shipping_address: null,
    tracking_number: null,
    carrier: null,
    remark: null,
    timeline: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    paid_at: null,
    shipped_at: null,
    completed_at: null,
    ...overrides,
  }
}

describe("getOrderViewKey", () => {
  it("returns the status verbatim for free-shipping orders", () => {
    expect(getOrderViewKey(makeOrder({ status: "pending_payment" }))).toBe("pending_payment")
    expect(getOrderViewKey(makeOrder({ status: "paid" }))).toBe("paid")
    expect(getOrderViewKey(makeOrder({ status: "shipped" }))).toBe("shipped")
  })

  it("routes to shipping_fee_pending when variable shipping is awaiting seller", () => {
    const o = makeOrder({
      listing: {
        id: "l1",
        title: "T",
        image_url: null,
        type: "secondhand",
        shipping_mode: "variable",
      },
      status: "paid",
      shipping_status: "pending",
    })
    expect(getOrderViewKey(o)).toBe("shipping_fee_pending")
  })

  it("routes to shipping_fee_paying when buyer needs to pay shipping", () => {
    const o = makeOrder({
      listing: {
        id: "l1",
        title: "T",
        image_url: null,
        type: "secondhand",
        shipping_mode: "variable",
      },
      status: "paid",
      shipping_status: "awaiting_payment",
    })
    expect(getOrderViewKey(o)).toBe("shipping_fee_paying")
  })

  it("falls back to status once variable shipping is paid", () => {
    const o = makeOrder({
      listing: {
        id: "l1",
        title: "T",
        image_url: null,
        type: "secondhand",
        shipping_mode: "variable",
      },
      status: "paid",
      shipping_status: "paid",
    })
    expect(getOrderViewKey(o)).toBe("paid")
  })
})

describe("progress steps", () => {
  it("marks earlier steps done and current step active", () => {
    const steps = getOrderProgressSteps(makeOrder({ status: "shipped" }))
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "active", "todo"])
  })
  it("treats pending_payment as the active first step", () => {
    const steps = getOrderProgressSteps(makeOrder({ status: "pending_payment" }))
    expect(steps[0].state).toBe("active")
    expect(steps[1].state).toBe("todo")
  })
})

describe("buyer / seller actions", () => {
  it("buyer pending_payment can pay or supply trade no", () => {
    const acts = getBuyerActions(makeOrder({ status: "pending_payment" }))
    expect(acts).toContain("buyer_pay")
    expect(acts).toContain("buyer_supply_trade_no")
  })

  it("buyer shipped can complete", () => {
    expect(getBuyerActions(makeOrder({ status: "shipped" }))).toContain("buyer_complete")
  })

  it("seller pending_confirm can confirm payment", () => {
    expect(getSellerActions(makeOrder({ status: "pending_confirm" }))).toContain(
      "seller_confirm_payment"
    )
  })

  it("seller paid + variable shipping pending can set shipping fee", () => {
    const acts = getSellerActions(
      makeOrder({
        status: "paid",
        listing: {
          id: "l1",
          title: "T",
          image_url: null,
          type: "secondhand",
          shipping_mode: "variable",
        },
        shipping_status: "pending",
      })
    )
    expect(acts).toContain("seller_set_shipping_fee")
  })

  it("seller paid + free shipping + no tracking can ship", () => {
    expect(
      getSellerActions(
        makeOrder({
          status: "paid",
          listing: {
            id: "l1",
            title: "T",
            image_url: null,
            type: "secondhand",
            shipping_mode: "free",
          },
        })
      )
    ).toContain("seller_ship")
  })
})
