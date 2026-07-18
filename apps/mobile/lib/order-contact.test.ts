import { describe, expect, it } from "vitest";
import { resolveOrderContactAction } from "./order-contact";

describe("order contact action", () => {
  it.each([
    [
      { orderType: "spot", view: "buyer" } as const,
      { label: "联系卖家", target: "spot-seller" },
    ],
    [{ orderType: "spot", view: "seller" } as const, null],
    [
      { orderType: "errand", view: "participant" } as const,
      { label: "联系团长", target: "errand-captain" },
    ],
    [{ orderType: "errand", view: "captain" } as const, null],
  ])("resolves the contact target for %o", (context, expected) => {
    expect(
      resolveOrderContactAction({
        ...context,
        isFeishuEnvironment: true,
      }),
    ).toEqual(expected);
  });

  it.each([
    { orderType: "spot", view: "buyer" } as const,
    {
      orderType: "errand",
      view: "participant",
    } as const,
  ])("hides %o outside Feishu", (context) => {
    expect(
      resolveOrderContactAction({
        ...context,
        isFeishuEnvironment: false,
      }),
    ).toBeNull();
  });
});
