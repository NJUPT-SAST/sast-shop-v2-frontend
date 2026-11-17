import { describe, expect, it, vi } from "vitest";

import {
  getAlipayPaymentUrl,
  getPaymentScanUrl,
  openAlipayPayment,
  openPaymentScanner,
} from "./payment-app-links";

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

  it("passes the entire collection code as one encoded scanner parameter", () => {
    const content = "https://qr.alipay.com/fkx123?amount=1.00&memo=a%26b#code";
    const url = new URL(getAlipayPaymentUrl(` ${content} `)!);

    expect(url.protocol).toBe("alipays:");
    expect(url.hostname).toBe("platformapi");
    expect(url.pathname).toBe("/startapp");
    expect([...url.searchParams]).toEqual([
      ["saId", "10000007"],
      ["qrcode", content],
    ]);
    expect(url.hash).toBe("");
  });

  it.each([
    "",
    "https://qr.alipay.com/",
    "https://qr.alipay.com/code/..",
    "http://qr.alipay.com/fkx123",
    "https://qr.alipay.com.evil.example/fkx123",
    "https://qr.alipay.com@evil.example/fkx123",
    "https://user:password@qr.alipay.com/fkx123",
    "https://qr.alipay.com:8443/fkx123",
    "https://qr.alipay.com/fkx123\n&appId=20000067",
    "https://qr.alipay.com/" + "a".repeat(512),
    "alipays://platformapi/startapp?appId=20000067&url=https://evil.example",
    "wxp://test",
    "javascript:alert(1)",
  ])("does not offer a payment link for unsupported content: %s", (content) => {
    const assign = vi.fn();

    expect(getAlipayPaymentUrl(content)).toBeNull();
    expect(() => openAlipayPayment(content, { assign })).toThrow();
    expect(assign).not.toHaveBeenCalled();
  });

  it("opens the current collection code without requiring a saved image", () => {
    const content = "https://qr.alipay.com/fkx123";
    const assign = vi.fn();

    openAlipayPayment(content, { assign });

    expect(assign).toHaveBeenCalledExactlyOnceWith(
      getAlipayPaymentUrl(content),
    );
  });

  it("propagates a blocked navigation so the caller can offer the QR fallback", () => {
    const blocked = new Error("blocked");
    expect(() =>
      openAlipayPayment("https://qr.alipay.com/fkx123", {
        assign: () => {
          throw blocked;
        },
      }),
    ).toThrow(blocked);
  });
});
