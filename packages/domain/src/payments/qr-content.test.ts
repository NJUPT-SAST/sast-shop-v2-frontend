import { describe, expect, it } from "vitest";

import {
  MAX_PAYMENT_QR_CONTENT_LENGTH,
  isPaymentQrContentAllowed,
  validatePaymentQrContent,
} from "./qr-content";

describe("payment QR content validation", () => {
  it("accepts recognized WeChat QR content", () => {
    expect(isPaymentQrContentAllowed("wechat", "wxp://f2f0example")).toBe(true);
    expect(
      isPaymentQrContentAllowed(
        "wechat",
        "https://wx.tenpay.com/f2f?t=AQAAATEST",
      ),
    ).toBe(true);
  });

  it("accepts recognized Alipay QR content", () => {
    expect(
      isPaymentQrContentAllowed("alipay", "https://qr.alipay.com/fkx123"),
    ).toBe(true);
    expect(
      isPaymentQrContentAllowed(
        "alipay",
        "alipays://platformapi/startapp?saId=10000007",
      ),
    ).toBe(true);
  });

  it("rejects content for the wrong channel", () => {
    expect(
      isPaymentQrContentAllowed("wechat", "https://qr.alipay.com/fkx123"),
    ).toBe(false);
    expect(isPaymentQrContentAllowed("alipay", "wxp://f2f0example")).toBe(
      false,
    );
  });

  it("rejects empty, control-character, and overlong content", () => {
    expect(validatePaymentQrContent("wechat", " ")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validatePaymentQrContent("wechat", "wxp://abc\u0000")).toEqual({
      ok: false,
      reason: "control-character",
    });
    expect(
      validatePaymentQrContent(
        "wechat",
        `wxp://${"a".repeat(MAX_PAYMENT_QR_CONTENT_LENGTH)}`,
      ),
    ).toEqual({
      ok: false,
      reason: "too-long",
    });
  });
});
