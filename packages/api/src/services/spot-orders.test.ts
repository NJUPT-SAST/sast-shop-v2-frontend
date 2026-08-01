import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ResourceNotFoundError,
  ValidationError,
} from "../errors";
import {
  cancelSpotOrder,
  completeSpotOrder,
  createSpotOrders,
  getSpotOrderDetail,
  getSpotOrderSellerContact,
  listSpotOrders,
  listSpotOrdersPage,
  type CreateSpotOrderInput,
  type SpotOrder,
} from "./spot-orders";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

const productSnapshot = {
  id: "4001",
  title: "农夫山泉矿泉水",
  storeId: "3001",
};

const validInput: CreateSpotOrderInput = {
  spotGoodsId: "2001",
  quantity: 2,
  updatedAt: "1970-01-01T00:00:02.000Z",
};

describe("spot order service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable spot order return types", () => {
    expectTypeOf<ReturnType<typeof listSpotOrders>>().toEqualTypeOf<
      Promise<SpotOrder[]>
    >();
    expectTypeOf<ReturnType<typeof listSpotOrdersPage>>().toEqualTypeOf<
      Promise<import("../pagination").PageResult<SpotOrder>>
    >();
    expectTypeOf<ReturnType<typeof createSpotOrders>>().toEqualTypeOf<
      Promise<SpotOrder[]>
    >();
    expectTypeOf<ReturnType<typeof getSpotOrderDetail>>().toEqualTypeOf<
      Promise<SpotOrder>
    >();
    expectTypeOf<ReturnType<typeof getSpotOrderSellerContact>>().toEqualTypeOf<
      Promise<string>
    >();
    expectTypeOf<ReturnType<typeof cancelSpotOrder>>().toEqualTypeOf<
      Promise<SpotOrder>
    >();
    expectTypeOf<ReturnType<typeof completeSpotOrder>>().toEqualTypeOf<
      Promise<SpotOrder>
    >();
  });

  it("gets the authorized seller Feishu contact", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({ sellerFeishuOpenId: "ou_seller_5001" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSpotOrderSellerContact("5001", localOptions)).resolves.toBe(
      "ou_seller_5001",
    );
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/GetSpotOrderSellerContact",
      body: { spotOrderId: "5001" },
    });
  });

  it("deduplicates orders returned by multiple store queries", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      const pathname = new URL(url).pathname;

      if (pathname.includes("GetStoreList")) {
        return stubJsonResponse({
          stores: [
            { id: "3001", name: "SAST 小卖部" },
            { id: "3002", name: "南邮校园超市" },
          ],
        });
      }

      const storeRequestIndex = fetchMock.mock.calls.length - 1;
      return stubJsonResponse({
        spotOrders: [
          {
            id: "5001",
            orderNo: "SO-5001",
            store: { id: "3001", name: "SAST 小卖部" },
            productSnapshot: { title: "矿泉水" },
            quantity: 2,
            unitPriceCents: 200,
            totalAmountCents: 400,
            status: "SPOT_ORDER_STATUS_PENDING_PAYMENT",
          },
        ],
        currentPage: 1,
        totalCount: storeRequestIndex === 1 ? 51 : 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await listSpotOrdersPage(localOptions);

    expect(page.items.map((order) => order.id)).toEqual(["5001"]);
    expect(page).toMatchObject({
      currentPage: 1,
      pageSize: 50,
      totalCount: 52,
      hasMore: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("continues an aggregate page when only one store has more orders", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      const pathname = new URL(url).pathname;

      if (pathname.includes("GetStoreList")) {
        return stubJsonResponse({
          stores: [
            { id: "3001", name: "SAST 小卖部" },
            { id: "3002", name: "南邮校园超市" },
          ],
        });
      }

      const storeRequestIndex = fetchMock.mock.calls.length - 1;
      const hasOrders = storeRequestIndex === 2;
      return stubJsonResponse({
        spotOrders: hasOrders
          ? [
              {
                id: "5051",
                orderNo: "SO-5051",
                store: { id: "3002", name: "南邮校园超市" },
                productSnapshot: { title: "矿泉水" },
                quantity: 1,
                unitPriceCents: 200,
                totalAmountCents: 200,
                status: "SPOT_ORDER_STATUS_PAID",
              },
            ]
          : [],
        currentPage: 2,
        totalCount: hasOrders ? 101 : 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await listSpotOrdersPage({
      ...localOptions,
      page: 2,
      pageSize: 50,
    });

    expect(page.items.map((order) => order.id)).toEqual(["5051"]);
    expect(page).toMatchObject({
      currentPage: 2,
      totalCount: 102,
      hasMore: true,
    });
  });

  it("rejects a non-empty aggregate store page past its declared total", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const pathname = new URL(typeof input === "string" ? input : input.url)
        .pathname;
      if (pathname.includes("GetStoreList")) {
        return stubJsonResponse({
          stores: [{ id: "3001", name: "SAST 小卖部" }],
        });
      }
      return stubJsonResponse({
        spotOrders: [
          {
            id: "5051",
            orderNo: "SO-5051",
            store: { id: "3001", name: "SAST 小卖部" },
            productSnapshot: { title: "矿泉水" },
            quantity: 1,
            unitPriceCents: 200,
            totalAmountCents: 200,
            status: "SPOT_ORDER_STATUS_PAID",
          },
        ],
        currentPage: 2,
        totalCount: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listSpotOrdersPage({ ...localOptions, page: 2, pageSize: 50 }),
    ).rejects.toThrow("listSpotOrders.pagination");
  });

  it.each([
    {
      action: "cancel",
      call: cancelSpotOrder,
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/CancelSpotOrder",
      responseStatus: "SPOT_ORDER_STATUS_CANCELLED",
      expectedStatus: "cancelled",
    },
    {
      action: "complete",
      call: completeSpotOrder,
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/CompleteSpotOrder",
      responseStatus: "SPOT_ORDER_STATUS_COMPLETED",
      expectedStatus: "completed",
    },
  ])(
    "$action sends the order version and maps the updated order",
    async ({ call, path, responseStatus, expectedStatus }) => {
      const fetchMock = vi.fn(async () =>
        stubJsonResponse({
          spotOrderDetail: {
            id: "5001",
            orderNo: "SO-5001",
            productSnapshot,
            quantity: 1,
            unitPriceCents: 400,
            totalAmountCents: 400,
            billId: "9101",
            status: responseStatus,
          },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const order = await call(
        {
          spotOrderId: "5001",
          updatedAt: "2026-07-18T02:00:00Z",
        },
        localOptions,
      );

      expect(order).toMatchObject({ id: "5001", status: expectedStatus });
      await expectConnectRequest(fetchMock, {
        path,
        body: {
          spotOrderId: "5001",
          updatedAt: "2026-07-18T02:00:00Z",
        },
      });
    },
  );

  it("validates lifecycle mutations before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const spotOrderId of ["", "0", "01", "-1", "9223372036854775808"]) {
      await expect(
        cancelSpotOrder({ spotOrderId }, localOptions),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        completeSpotOrder({ spotOrderId }, localOptions),
      ).rejects.toBeInstanceOf(ValidationError);
    }

    await expect(
      cancelSpotOrder(
        { spotOrderId: "5001", updatedAt: "not-a-date" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits an unavailable order version instead of reusing another aggregate version", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotOrderDetail: {
          id: "5001",
          orderNo: "SO-5001",
          productSnapshot,
          quantity: 1,
          unitPriceCents: 400,
          totalAmountCents: 400,
          billId: "9101",
          status: "SPOT_ORDER_STATUS_CANCELLED",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cancelSpotOrder({ spotOrderId: "5001" }, localOptions);

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/CancelSpotOrder",
      body: { spotOrderId: "5001" },
    });
  });

  it.each([
    ["cancel", cancelSpotOrder],
    ["complete", completeSpotOrder],
  ] as const)(
    "rejects a %s response without an updated order",
    async (_, call) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => stubJsonResponse({})),
      );

      await expect(
        call({ spotOrderId: "5001" }, localOptions),
      ).rejects.toBeInstanceOf(FeatureUnavailableError);
    },
  );

  it("does not silently fall back for remote lifecycle mutations", async () => {
    await expect(
      cancelSpotOrder({ spotOrderId: "5001" }, { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    await expect(
      completeSpotOrder({ spotOrderId: "5001" }, { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("gets one complete spot order through the detail RPC", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotOrderDetail: {
          id: "5001",
          orderNo: "SO202606080001",
          store: {
            id: "3001",
            name: "SAST 小卖部",
            address: "仙林校区",
          },
          productSnapshot: {
            id: "1001",
            title: "SAST 贴纸",
            description: "社团周边",
            priceCents: 1599,
            storeId: "3001",
          },
          quantity: 2,
          unitPriceCents: 1299,
          totalAmountCents: 2598,
          billId: "91",
          seller: {
            id: "42",
            name: "南邮同学",
            avatarUrl: "https://example.com/avatar.png",
          },
          bill: {
            id: "91",
            billNo: "BILL-91",
            status: "BILL_STATUS_UNPAID",
            amountCents: 2598,
            verifyCode: "9137",
            channel: "CHANNEL_WECHAT",
            updatedAt: "1970-01-01T00:00:03Z",
          },
          status: "SPOT_ORDER_STATUS_PENDING_PAYMENT",
          createdAt: "1970-01-01T00:00:01Z",
          paidAt: "1970-01-01T00:00:04Z",
          completedAt: "1970-01-01T00:00:05Z",
          cancelledAt: "1970-01-01T00:00:06Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const order = await getSpotOrderDetail("5001", localOptions);

    expect(order).toMatchObject({
      id: "5001",
      orderNo: "SO202606080001",
      seller: {
        id: "42",
        name: "南邮同学",
        avatarUrl: "https://example.com/avatar.png",
      },
      bill: {
        id: "91",
        status: "unpaid",
        amountCents: 2598,
      },
      createdAt: "1970-01-01T00:00:01.000Z",
      paidAt: "1970-01-01T00:00:04.000Z",
      completedAt: "1970-01-01T00:00:05.000Z",
      cancelledAt: "1970-01-01T00:00:06.000Z",
      status: "pending_payment",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/GetSpotOrderDetail",
      body: { spotOrderId: "5001" },
    });
  });

  it("rejects invalid spot order IDs without submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const id of ["", "0", "01", "-1", "9223372036854775808"]) {
      await expect(getSpotOrderDetail(id, localOptions)).rejects.toBeInstanceOf(
        ValidationError,
      );
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the largest signed int64 spot order ID", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotOrderDetail: {
          id: "9223372036854775807",
          orderNo: "SO-MAX",
          productSnapshot,
          quantity: 1,
          unitPriceCents: 1,
          totalAmountCents: 1,
          billId: "0",
          status: "SPOT_ORDER_STATUS_COMPLETED",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getSpotOrderDetail("9223372036854775807", localOptions);

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/GetSpotOrderDetail",
      body: { spotOrderId: "9223372036854775807" },
    });
  });

  it("rejects detail responses without an order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse({})),
    );

    await expect(
      getSpotOrderDetail("5001", localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("preserves not-found semantics from the Connect backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          { code: "not_found", message: "spot order not found" },
          { status: 404 },
        ),
      ),
    );

    await expect(
      getSpotOrderDetail("5001", localOptions),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("creates spot orders through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotOrderDetails: [
          {
            id: "5001",
            orderNo: "SO202606080001",
            store: {
              id: "3001",
              name: "SAST 小卖部",
              address: "仙林校区",
              logoUrl: "https://example.com/logo.png",
              themeColor: "#166534",
            },
            productSnapshot: {
              id: "1001",
              title: "SAST 贴纸",
              description: "社团周边",
              priceCents: 1599,
              storeId: "3001",
              mainImageUrl: "https://example.com/sticker.png",
              barcode: "690000000001",
            },
            quantity: 2,
            unitPriceCents: 1299,
            totalAmountCents: 2598,
            billId: "91",
            bill: {
              id: "91",
              billNo: "BILL-91",
              status: "BILL_STATUS_UNPAID",
              amountCents: 2598,
              verifyCode: "9137",
              channel: "CHANNEL_WECHAT",
              updatedAt: "1970-01-01T00:00:03Z",
            },
            status: 1,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const orders = await createSpotOrders([validInput], localOptions);

    expect(orders).toEqual([
      expect.objectContaining({
        id: "5001",
        orderNo: "SO202606080001",
        productTitle: "SAST 贴纸",
        quantity: 2,
        totalAmountCents: 2598,
        billId: "91",
        bill: expect.objectContaining({
          id: "91",
          billNo: "BILL-91",
          status: "unpaid",
          amountCents: 2598,
          verifyCode: "9137",
          channel: "wechat",
          updatedAt: "1970-01-01T00:00:03.000Z",
        }),
        status: "pending_payment",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotOrderService/CreateSpotOrders",
      body: {
        spotOrders: [
          {
            spotListingId: "2001",
            quantity: 2,
            updatedAt: "1970-01-01T00:00:02Z",
          },
        ],
      },
    });
  });

  it("validates create spot order input before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createSpotOrders([], localOptions)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      createSpotOrders([{ ...validInput, spotGoodsId: "0" }], localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotOrders(
        [{ ...validInput, spotGoodsId: "9223372036854775808" }],
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotOrders([{ ...validInput, quantity: 0 }], localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotOrders(
        [{ ...validInput, updatedAt: "not-a-date" }],
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createSpotOrders([validInput], { dataSource: "local" }),
    ).rejects.toBeInstanceOf(ApiConfigurationError);
  });

  it("wraps local create failures in an API request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          {
            code: "unavailable",
            message: "backend unavailable",
          },
          { status: 503 },
        ),
      ),
    );

    await expect(
      createSpotOrders([validInput], localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createSpotOrders([validInput], { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
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

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string;
    body: Record<string, unknown>;
  },
) {
  const [input, init] = fetchMock.mock.calls[0] ?? [];
  const url = typeof input === "string" ? input : (input as Request).url;
  const body =
    typeof input === "string"
      ? init?.body
      : await (input as Request).clone().text();

  expect(new URL(url).pathname).toBe(expected.path);
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body);
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }

  return String(body);
}
