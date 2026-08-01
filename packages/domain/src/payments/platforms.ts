export type PaymentPlatform = "wechat" | "alipay";

export const PAYMENT_PLATFORM_META: Record<
  PaymentPlatform,
  {
    label: string;
    tone: PaymentPlatform;
  }
> = {
  wechat: {
    label: "微信支付",
    tone: "wechat",
  },
  alipay: {
    label: "支付宝",
    tone: "alipay",
  },
};
