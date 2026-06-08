import {
  mockPaymentQrCodes,
  type MockPaymentQrChannel,
  type MockPaymentQrCode,
} from "../fixtures/payment-qr-codes"

export interface MockPaymentQrCodeInput {
  channel: MockPaymentQrChannel
  content: string
}

export function listMockPaymentQrCodes(): MockPaymentQrCode[] {
  return mockPaymentQrCodes
}

export function updateMockPaymentQrCode(
  input: MockPaymentQrCodeInput
): MockPaymentQrCode {
  const existing = mockPaymentQrCodes.find(
    (qrCode) => qrCode.channel === input.channel
  )

  return {
    id: existing?.id ?? "2003",
    channel: input.channel,
    content: input.content,
  }
}
