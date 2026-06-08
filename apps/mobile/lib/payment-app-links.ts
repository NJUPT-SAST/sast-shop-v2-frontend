import type { PaymentPlatform } from "./payment-preferences";

export function getPaymentScanUrl(platform: PaymentPlatform) {
  switch (platform) {
    case "wechat":
      return "weixin://scanqrcode";
    case "alipay":
      return "alipays://platformapi/startapp?saId=10000007";
  }
}

export function openPaymentScanner(
  platform: PaymentPlatform,
  locationLike: Pick<Location, "assign"> = window.location,
) {
  locationLike.assign(getPaymentScanUrl(platform));
}
