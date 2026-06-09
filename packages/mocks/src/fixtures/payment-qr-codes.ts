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
    content: "wxp://f2f0sastshopwechat",
  },
  {
    id: "2002",
    channel: "alipay",
    content: "https://qr.alipay.com/fkx-sast-shop",
  },
]
