export type PaymentPlatform = "wechat" | "alipay";

export const DEFAULT_PAYMENT_PLATFORM: PaymentPlatform = "wechat";
export const PAYMENT_PLATFORM_STORAGE_KEY =
  "sast-shop.default-payment-platform";

export function isPaymentPlatform(value: unknown): value is PaymentPlatform {
  return value === "wechat" || value === "alipay";
}

export function readDefaultPaymentPlatform(
  storage: Storage | undefined = getBrowserStorage(),
): PaymentPlatform {
  const storedPlatform = storage?.getItem(PAYMENT_PLATFORM_STORAGE_KEY);

  return isPaymentPlatform(storedPlatform)
    ? storedPlatform
    : DEFAULT_PAYMENT_PLATFORM;
}

export function writeDefaultPaymentPlatform(
  platform: PaymentPlatform,
  storage: Storage | undefined = getBrowserStorage(),
) {
  storage?.setItem(PAYMENT_PLATFORM_STORAGE_KEY, platform);
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
