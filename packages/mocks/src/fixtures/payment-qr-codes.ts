export type MockPaymentQrChannel = "wechat" | "alipay"

export interface MockPaymentQrCode {
  id: string
  channel: MockPaymentQrChannel
  content: string
}

export const mockPaymentQrCodes: MockPaymentQrCode[] = [
  {
    id: "2001",
    channel: "wechat",
    content: "https://example.test/pay/wechat/sast",
  },
  {
    id: "2002",
    channel: "alipay",
    content: "https://example.test/pay/alipay/sast",
  },
]
