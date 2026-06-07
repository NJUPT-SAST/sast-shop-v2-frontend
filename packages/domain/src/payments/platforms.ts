export type PaymentPlatform = "wechat" | "alipay";

export const PAYMENT_PLATFORM_META: Record<
  PaymentPlatform,
  {
    label: string;
    colorClassName: string;
  }
> = {
  wechat: {
    label: "微信支付",
    colorClassName: "bg-green-500"
  },
  alipay: {
    label: "支付宝",
    colorClassName: "bg-blue-500"
  }
};
