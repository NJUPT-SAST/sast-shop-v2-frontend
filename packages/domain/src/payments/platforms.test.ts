import { describe, expect, it } from "vitest";

import { PAYMENT_PLATFORM_META } from "./platforms";

describe("PAYMENT_PLATFORM_META", () => {
  it("contains semantic metadata for payment platforms", () => {
    expect(PAYMENT_PLATFORM_META.wechat).toEqual({
      label: "微信支付",
      tone: "wechat",
    });
    expect(PAYMENT_PLATFORM_META.alipay).toEqual({
      label: "支付宝",
      tone: "alipay",
    });
  });
});
