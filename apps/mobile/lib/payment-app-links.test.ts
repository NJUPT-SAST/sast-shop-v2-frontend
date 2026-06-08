import { describe, expect, it, vi } from "vitest";

import { getPaymentScanUrl, openPaymentScanner } from "./payment-app-links";

describe("payment app links", () => {
  it("returns the WeChat scanner URL scheme", () => {
    expect(getPaymentScanUrl("wechat")).toBe("weixin://scanqrcode");
  });

  it("returns the Alipay scanner URL scheme", () => {
    expect(getPaymentScanUrl("alipay")).toBe(
      "alipays://platformapi/startapp?saId=10000007",
    );
  });

  it("opens the scanner through an injected location assign function", () => {
    const assign = vi.fn();

    openPaymentScanner("alipay", { assign });

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(
      "alipays://platformapi/startapp?saId=10000007",
    );
  });
});
