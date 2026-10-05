export type PaymentPlatform = "wechat" | "alipay";

export const DEFAULT_PAYMENT_PLATFORM: PaymentPlatform = "wechat";
export const PAYMENT_PLATFORM_STORAGE_KEY =
  "sast-shop.default-payment-platform";
const preferenceChangedEvent = "sast-shop:payment-preference-changed";

export function subscribePaymentPreference(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === PAYMENT_PLATFORM_STORAGE_KEY || event.key === null)
      onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(preferenceChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(preferenceChangedEvent, onChange);
  };
}

export function isPaymentPlatform(value: unknown): value is PaymentPlatform {
  return value === "wechat" || value === "alipay";
}

export function readDefaultPaymentPlatform(
  storage: Pick<Storage, "getItem"> | undefined = getBrowserStorage(),
): PaymentPlatform {
  try {
    const platform = storage?.getItem(PAYMENT_PLATFORM_STORAGE_KEY);
    return isPaymentPlatform(platform) ? platform : DEFAULT_PAYMENT_PLATFORM;
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
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event(preferenceChangedEvent));
    return true;
  } catch {
    return false;
  }
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
