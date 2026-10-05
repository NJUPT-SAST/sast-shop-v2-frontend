import { describe, expect, it, vi } from "vitest";
import {
  PAYMENT_PLATFORM_STORAGE_KEY,
  readDefaultPaymentPlatform,
  writeDefaultPaymentPlatform,
} from "./payment-preferences";

describe("desktop payment preference", () => {
  it("reads the same preference key as mobile", () => {
    const getItem = vi.fn().mockReturnValue("alipay");
    expect(readDefaultPaymentPlatform({ getItem })).toBe("alipay");
    expect(getItem).toHaveBeenCalledWith(PAYMENT_PLATFORM_STORAGE_KEY);
  });

  it("uses WeChat when storage is inaccessible or the preference is invalid", () => {
    expect(
      readDefaultPaymentPlatform({
        getItem: () => {
          throw new Error("Blocked");
        },
      }),
    ).toBe("wechat");
    expect(readDefaultPaymentPlatform({ getItem: () => "unknown" })).toBe(
      "wechat",
    );
  });

  it("reports storage failures instead of pretending a setting was saved", () => {
    expect(
      writeDefaultPaymentPlatform("alipay", {
        setItem: () => {
          throw new Error("Quota");
        },
      }),
    ).toBe(false);
    const setItem = vi.fn();
    expect(writeDefaultPaymentPlatform("alipay", { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(
      PAYMENT_PLATFORM_STORAGE_KEY,
      "alipay",
    );
  });
});
