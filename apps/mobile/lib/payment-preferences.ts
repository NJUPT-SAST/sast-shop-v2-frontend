export type PaymentPlatform = "wechat" | "alipay";

export const DEFAULT_PAYMENT_PLATFORM: PaymentPlatform = "wechat";
export const PAYMENT_PLATFORM_STORAGE_KEY =
  "sast-shop.default-payment-platform";

export function isPaymentPlatform(value: unknown): value is PaymentPlatform {
  return value === "wechat" || value === "alipay";
}

export function readDefaultPaymentPlatform(
  storage: Pick<Storage, "getItem"> | undefined = getBrowserStorage(),
): PaymentPlatform {
  try {
    const storedPlatform = storage?.getItem(PAYMENT_PLATFORM_STORAGE_KEY);
    return isPaymentPlatform(storedPlatform)
      ? storedPlatform
      : DEFAULT_PAYMENT_PLATFORM;
  } catch {
    return DEFAULT_PAYMENT_PLATFORM;
  }
}

export function writeDefaultPaymentPlatform(
  platform: PaymentPlatform,
  storage: Pick<Storage, "setItem"> | undefined = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PAYMENT_PLATFORM_STORAGE_KEY, platform);
    return true;
  } catch {
    return false;
  }
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
