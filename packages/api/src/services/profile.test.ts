import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CurrentUser } from "./auth";
import type { ShippingAddress } from "./addresses";
import type { PaymentQrCode } from "./payment-qr-codes";
import { getProfileOverview, type ProfileOverview } from "./profile";

describe("profile service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable profile overview return types", () => {
    expectTypeOf<typeof getProfileOverview>().returns.toEqualTypeOf<
      Promise<ProfileOverview>
    >();
    expectTypeOf<ProfileOverview>().toEqualTypeOf<{
      user: CurrentUser;
      addresses: ShippingAddress[];
      defaultAddress: ShippingAddress | null;
      paymentQrCodes: PaymentQrCode[];
    }>();
  });

  it("composes fauxrpc profile overview in mock mode", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      const pathname = new URL(url).pathname;

      if (pathname.includes("GetUserInfo")) {
        return stubJsonResponse({
          userInfo: {
            id: "10001",
            name: "fauxrpc 同学",
            avatarUrl: "https://example.test/avatar.png",
          },
        });
      }

      if (pathname.includes("GetAddress")) {
        return stubJsonResponse({
          shippingAddresses: [
            {
              id: "1001",
              recipientName: "fauxrpc 同学",
              recipientPhone: "13800000001",
              province: "江苏省",
              city: "南京市",
              district: "栖霞区",
              detailAddress: "南京邮电大学仙林校区 SAST 活动室",
              isDefault: true,
            },
          ],
        });
      }

      if (pathname.includes("GetQrCode")) {
        return stubJsonResponse({
          qrCodes: [
            {
              id: "2001",
              channel: "CHANNEL_WECHAT",
              content: "wxp://sast-shop",
            },
            {
              id: "2002",
              channel: "CHANNEL_ALIPAY",
              content: "https://qr.alipay.com/sast-shop",
            },
          ],
        });
      }

      return stubJsonResponse(
        { code: "unimplemented", message: "unexpected request" },
        { status: 404 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const overview = await getProfileOverview({
      dataSource: "mock",
      connectBaseUrl: "http://127.0.0.1:6660",
    });

    expect(overview.user.name).toBe("fauxrpc 同学");
    expect(overview.defaultAddress?.id).toBe("1001");
    expect(overview.addresses).toHaveLength(1);
    expect(overview.paymentQrCodes.map((qrCode) => qrCode.channel)).toEqual([
      "wechat",
      "alipay",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
