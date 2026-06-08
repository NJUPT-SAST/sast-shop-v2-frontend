import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PAYMENT_PLATFORM,
  PAYMENT_PLATFORM_STORAGE_KEY,
  isPaymentPlatform,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
} from "./payment-preferences";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("payment preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates supported payment platforms only", () => {
    expect(isPaymentPlatform("wechat")).toBe(true);
    expect(isPaymentPlatform("alipay")).toBe(true);
    expect(isPaymentPlatform("bank")).toBe(false);
    expect(isPaymentPlatform(undefined)).toBe(false);
  });

  it("falls back to the default platform for missing storage", () => {
    expect(readDefaultPaymentPlatform(undefined)).toBe(
      DEFAULT_PAYMENT_PLATFORM,
    );
  });

  it("falls back to the default platform for missing or invalid stored values", () => {
    const storage = new MemoryStorage();

    expect(readDefaultPaymentPlatform(storage)).toBe(DEFAULT_PAYMENT_PLATFORM);

    storage.setItem(PAYMENT_PLATFORM_STORAGE_KEY, "bank");

    expect(readDefaultPaymentPlatform(storage)).toBe(DEFAULT_PAYMENT_PLATFORM);
  });

  it("persists alipay as the default platform", () => {
    const storage = new MemoryStorage();

    writeDefaultPaymentPlatform("alipay", storage);

    expect(storage.getItem(PAYMENT_PLATFORM_STORAGE_KEY)).toBe("alipay");
    expect(readDefaultPaymentPlatform(storage)).toBe("alipay");
  });

  it("skips writes when storage is unavailable", () => {
    expect(() =>
      writeDefaultPaymentPlatform("alipay", undefined),
    ).not.toThrow();
  });

  it("falls back when browser storage access throws", () => {
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      }),
    );

    expect(readDefaultPaymentPlatform()).toBe(DEFAULT_PAYMENT_PLATFORM);
    expect(() => writeDefaultPaymentPlatform("alipay")).not.toThrow();
  });
});
