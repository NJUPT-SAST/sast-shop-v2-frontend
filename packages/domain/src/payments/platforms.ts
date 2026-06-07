export enum PaymentPlatform {
  WechatPay = "wechat_pay",
  Alipay = "alipay"
}

export const PAYMENT_PLATFORM_META: Record<
  PaymentPlatform,
  {
    label: string;
  }
> = {
  [PaymentPlatform.WechatPay]: {
    label: "微信支付"
  },
  [PaymentPlatform.Alipay]: {
    label: "支付宝"
  }
};
