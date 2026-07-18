import { describe, expect, it } from "vitest"

import { resolveSpotOrderPaymentState } from "./spot-order-payment-state"

describe("resolveSpotOrderPaymentState", () => {
  it("allows payment only for an unpaid pending order", () => {
    expect(resolveSpotOrderPaymentState("pending_payment", "unpaid")).toEqual({
      kind: "payable",
      canPay: true,
      canSupplementSerialNumber: false,
    })
  })

  it("waits for confirmation after payment is submitted", () => {
    expect(
      resolveSpotOrderPaymentState("pending_payment", "submitted")
    ).toEqual({
      kind: "awaiting_confirmation",
      canPay: false,
      canSupplementSerialNumber: true,
    })
  })

  it.each(["completed", "closed", "unknown", undefined] as const)(
    "does not allow payment for %s bills",
    (billStatus) => {
      expect(
        resolveSpotOrderPaymentState("pending_payment", billStatus).canPay
      ).toBe(false)
    }
  )

  it.each(["paid", "completed", "cancelled", "unknown"] as const)(
    "does not expose payment actions for %s orders",
    (orderStatus) => {
      expect(
        resolveSpotOrderPaymentState(orderStatus, "unpaid")
      ).toMatchObject({
        canPay: false,
        canSupplementSerialNumber: false,
      })
    }
  )
})
