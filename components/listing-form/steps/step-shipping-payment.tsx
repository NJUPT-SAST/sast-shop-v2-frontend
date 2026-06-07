"use client"

import type { PaymentMode } from "@/lib/api/types"
import { ShippingPaymentFields } from "../shared"

export function StepShippingPayment({ lockedPaymentMode }: { lockedPaymentMode?: PaymentMode }) {
  return <ShippingPaymentFields lockedPaymentMode={lockedPaymentMode} />
}
