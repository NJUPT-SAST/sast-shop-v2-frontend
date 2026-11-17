import { validatePaymentQrContent } from "@sast-shop/domain";

import type { PaymentPlatform } from "./payment-preferences";

export function getAlipayPaymentUrl(content: string): string | null {
  const validated = validatePaymentQrContent("alipay", content);
  if (!validated.ok) return null;

  try {
    const url = new URL(validated.content);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "qr.alipay.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname === "/"
    ) {
      return null;
    }

    return `${getPaymentScanUrl("alipay")}&qrcode=${encodeURIComponent(validated.content)}`;
  } catch {
    return null;
  }
}

export function openAlipayPayment(
  content: string,
  locationLike: Pick<Location, "assign"> = window.location,
) {
  const url = getAlipayPaymentUrl(content);
  if (!url) throw new Error("当前收款码不支持直接跳转，请保存收款码后扫码支付");
  locationLike.assign(url);
}

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
