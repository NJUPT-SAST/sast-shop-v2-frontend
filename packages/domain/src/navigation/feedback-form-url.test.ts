import { describe, expect, it } from "vitest";
import { resolveFeedbackFormUrl } from "./feedback-form-url";

describe("feedback form URL", () => {
  it.each([undefined, "", "   "])(
    "returns null when the form URL is not configured (%s)",
    (value) => {
      expect(resolveFeedbackFormUrl(value)).toBeNull();
    },
  );

  it.each([
    "/feedback",
    "not-a-url",
    "http://example.test/form",
    "ftp://example.test/form",
    "javascript:alert(1)",
    "https://user:password@example.test/form",
    "https://example.com/form",
    "https://feishu.cn.evil.test/form",
    "https://evilfeishu.cn/form",
    "https://127.0.0.1/form",
  ])("rejects unsafe form URL %s", (value) => {
    expect(resolveFeedbackFormUrl(value)).toBeNull();
  });

  it("normalizes a valid HTTPS form URL and preserves its form state", () => {
    expect(
      resolveFeedbackFormUrl(
        "  https://wenjuan.feishu.cn/share/base/form/abc?prefill=1#intro  ",
      ),
    ).toBe("https://wenjuan.feishu.cn/share/base/form/abc?prefill=1#intro");
  });

  it("accepts a Lark form URL", () => {
    expect(
      resolveFeedbackFormUrl("https://example.larksuite.com/share/form/abc"),
    ).toBe("https://example.larksuite.com/share/form/abc");
  });
});
