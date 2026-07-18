import type {
  PaymentBillStatus,
  SpotOrderStatusValue,
} from "@sast-shop/api"

export type SpotOrderPaymentState = {
  kind: "payable" | "awaiting_confirmation" | "settled" | "unavailable"
  canPay: boolean
  canSupplementSerialNumber: boolean
}

export function resolveSpotOrderPaymentState(
  orderStatus: SpotOrderStatusValue,
  billStatus?: PaymentBillStatus
): SpotOrderPaymentState {
  if (orderStatus !== "pending_payment") {
    return {
      kind: "settled",
      canPay: false,
      canSupplementSerialNumber: false,
    }
  }

  if (billStatus === "unpaid") {
    return {
      kind: "payable",
      canPay: true,
      canSupplementSerialNumber: false,
    }
  }

  if (billStatus === "submitted") {
    return {
      kind: "awaiting_confirmation",
      canPay: false,
      canSupplementSerialNumber: true,
    }
  }

  return {
    kind: billStatus === "completed" ? "settled" : "unavailable",
    canPay: false,
    canSupplementSerialNumber: false,
  }
}
