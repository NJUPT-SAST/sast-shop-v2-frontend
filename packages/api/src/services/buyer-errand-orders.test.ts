import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  FeatureUnavailableError,
  ResourceNotFoundError,
  ValidationError,
} from "../errors";
import {
  getBuyerErrandOrderCaptainContact,
  getBuyerErrandOrderDetail,
  listBuyerErrandOrders,
  type BuyerErrandOrder,
  type BuyerErrandOrderDetail,
  type BuyerErrandOrderStatusFilter,
} from "./buyer-errand-orders";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

describe("buyer errand order service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes a stable buyer errand order return type", () => {
    expectTypeOf<ReturnType<typeof listBuyerErrandOrders>>().toEqualTypeOf<
      Promise<BuyerErrandOrder[]>
    >();
    expectTypeOf<ReturnType<typeof getBuyerErrandOrderDetail>>().toEqualTypeOf<
      Promise<BuyerErrandOrderDetail>
    >();
    expectTypeOf<
      ReturnType<typeof getBuyerErrandOrderCaptainContact>
    >().toEqualTypeOf<Promise<string>>();
  });

  it("gets the authorized captain Feishu contact", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({ captainFeishuOpenId: "ou_captain_9001" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getBuyerErrandOrderCaptainContact("9001", localOptions),
    ).resolves.toBe("ou_captain_9001");
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.BuyerErrandOrderService/GetBuyerErrandOrderCaptainContact",
      body: { errandDemandId: "9001" },
    });
  });

  it("gets and maps a buyer errand order detail", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        order: {
          errandDemandId: "9001",
          storeId: "3001",
          createdAt: "2026-06-09T08:30:00Z",
          storeInfo: {
            id: "3001",
            name: "SAST 小卖部",
            address: "仙林校区",
            logoUrl: "https://example.com/logo.png",
            themeColor: "#0071e3",
          },
          status: "ERRAND_DEMAND_STATUS_PENDING_PAYMENT",
          productItems: [
            {
              productTemplate: {
                id: "1001",
                title: "SAST 贴纸",
                description: "社团周边",
                priceCents: 1599,
                storeId: "3001",
                mainImageUrl: "https://example.com/sticker.png",
                barcode: "690000000001",
                updatedAt: "2026-06-09T08:00:00Z",
              },
              actualUnitPriceCents: 1499,
              requiredQuantity: 2,
              purchasedQuantity: 2,
              distributedQuantity: 1,
              serviceFeePerUnitCents: 300,
              subtotalCents: 1799,
              errandDemandItemId: "7001",
            },
            {
              productTemplate: {
                id: "1002",
                title: "缺货商品",
                description: "本次未购得",
                priceCents: 2000,
                storeId: "3001",
                mainImageUrl: "https://example.com/out-of-stock.png",
                barcode: "690000000002",
                updatedAt: "2026-06-09T08:00:00Z",
              },
              actualUnitPriceCents: 0,
              requiredQuantity: 1,
              purchasedQuantity: 0,
              distributedQuantity: 0,
              nonPurchaseReason: "缺货",
              serviceFeePerUnitCents: 200,
              subtotalCents: 0,
              errandDemandItemId: "7002",
            },
          ],
          totalOriginAmountCents: 3198,
          totalActualAmountCents: 2998,
          totalServiceFeeCents: 600,
          captainInfo: {
            id: "42",
            name: "团长张三",
            avatarUrl: "https://example.com/captain.png",
          },
          bill: {
            id: "9201",
            billNo: "ERRAND-9201",
            payer: { id: "7", name: "买家李四" },
            payee: { id: "42", name: "团长张三" },
            status: "BILL_STATUS_UNPAID",
            amountCents: 3598,
            verifyCode: "2718",
            createdAt: "2026-06-09T10:00:00Z",
            updatedAt: "2026-06-09T10:01:00Z",
            sourceType: "errand_demand",
            sourceId: "9001",
          },
          deadline: "2026-06-09T14:00:00Z",
          shoppingStartAt: "2026-06-09T09:00:00Z",
          shoppingCompletedAt: "2026-06-09T09:30:00Z",
          distributionCompletedAt: "2026-06-09T10:00:00Z",
          paymentCompletedAt: "2026-06-09T10:30:00Z",
          cancelledAt: "2026-06-09T11:00:00Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const order = await getBuyerErrandOrderDetail("9001", localOptions);

    expect(order).toEqual({
      id: "9001",
      storeId: "3001",
      createdAt: "2026-06-09T08:30:00.000Z",
      store: {
        id: "3001",
        name: "SAST 小卖部",
        address: "仙林校区",
        logoUrl: "https://example.com/logo.png",
        themeColor: "#0071e3",
      },
      status: "pending_payment",
      productItems: [
        {
          productTemplate: {
            id: "1001",
            title: "SAST 贴纸",
            description: "社团周边",
            priceCents: 1599,
            storeId: "3001",
            mainImageUrl: "https://example.com/sticker.png",
            barcode: "690000000001",
            updatedAt: "2026-06-09T08:00:00.000Z",
          },
          actualUnitPriceCents: 1499,
          requiredQuantity: 2,
          purchasedQuantity: 2,
          distributedQuantity: 1,
          nonPurchaseReason: null,
          serviceFeePerUnitCents: 300,
          subtotalCents: 1799,
          demandItemId: "7001",
        },
        {
          productTemplate: {
            id: "1002",
            title: "缺货商品",
            description: "本次未购得",
            priceCents: 2000,
            storeId: "3001",
            mainImageUrl: "https://example.com/out-of-stock.png",
            barcode: "690000000002",
            updatedAt: "2026-06-09T08:00:00.000Z",
          },
          actualUnitPriceCents: 0,
          requiredQuantity: 1,
          purchasedQuantity: 0,
          distributedQuantity: 0,
          nonPurchaseReason: "缺货",
          serviceFeePerUnitCents: 200,
          subtotalCents: 0,
          demandItemId: "7002",
        },
      ],
      totalOriginAmountCents: 3198,
      totalActualAmountCents: 2998,
      totalServiceFeeCents: 600,
      captain: {
        id: "42",
        name: "团长张三",
        avatarUrl: "https://example.com/captain.png",
      },
      bill: expect.objectContaining({
        id: "9201",
        payer: { id: "7", name: "买家李四", avatarUrl: "" },
        payee: { id: "42", name: "团长张三", avatarUrl: "" },
        status: "unpaid",
        amountCents: 3598,
        verifyCode: "2718",
        updatedAt: "2026-06-09T10:01:00.000Z",
      }),
      deadline: "2026-06-09T14:00:00.000Z",
      shoppingStartAt: "2026-06-09T09:00:00.000Z",
      shoppingCompletedAt: "2026-06-09T09:30:00.000Z",
      distributionCompletedAt: "2026-06-09T10:00:00.000Z",
      paymentCompletedAt: "2026-06-09T10:30:00.000Z",
      cancelledAt: "2026-06-09T11:00:00.000Z",
    });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.BuyerErrandOrderService/GetBuyerErrandOrderDetail",
      body: { errandDemandId: "9001" },
    });
  });

  it("maps missing detail fields to null without inventing data", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        order: {
          errandDemandId: "9002",
          storeId: "3001",
          status: "ERRAND_DEMAND_STATUS_OPEN",
          productItems: [
            {
              productTemplate: {
                id: "1001",
                title: "SAST 贴纸",
                storeId: "3001",
              },
              requiredQuantity: 1,
              errandDemandItemId: "7001",
            },
          ],
          totalOriginAmountCents: 0,
          totalServiceFeeCents: 0,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const order = await getBuyerErrandOrderDetail("9002", localOptions);

    expect(order).toMatchObject({
      createdAt: null,
      store: null,
      totalActualAmountCents: null,
      captain: null,
      bill: null,
      deadline: null,
      shoppingStartAt: null,
      shoppingCompletedAt: null,
      distributionCompletedAt: null,
      paymentCompletedAt: null,
      cancelledAt: null,
    });
  });

  it("rejects a detail response without product snapshots", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        order: {
          errandDemandId: "9002",
          storeId: "3001",
          status: "ERRAND_DEMAND_STATUS_OPEN",
          productItems: [{ requiredQuantity: 1, errandDemandItemId: "7001" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getBuyerErrandOrderDetail("9002", localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("validates buyer errand order detail IDs before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const id of ["", "0", "01", "-1", "9223372036854775808"]) {
      await expect(
        getBuyerErrandOrderDetail(id, localOptions),
      ).rejects.toBeInstanceOf(ValidationError);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the maximum signed int64 detail ID", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        order: {
          errandDemandId: "9223372036854775807",
          storeId: "1",
          status: "ERRAND_DEMAND_STATUS_OPEN",
          productItems: [
            {
              productTemplate: {
                id: "1",
                title: "测试商品",
                storeId: "1",
              },
              requiredQuantity: 1,
              errandDemandItemId: "1",
            },
          ],
          totalOriginAmountCents: 0,
          totalServiceFeeCents: 0,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getBuyerErrandOrderDetail("9223372036854775807", localOptions);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails explicitly when the detail response omits the order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse({})),
    );

    await expect(
      getBuyerErrandOrderDetail("9001", localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("preserves not-found responses from the detail endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          { code: "not_found", message: "order not found" },
          { status: 404 },
        ),
      ),
    );

    await expect(
      getBuyerErrandOrderDetail("9001", localOptions),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("lists buyer errand orders through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        orders: [
          {
            errandDemandId: "9001",
            storeId: "3001",
            createdAt: "2026-06-09T08:30:00Z",
            storeInfo: {
              id: "3001",
              name: "SAST 小卖部",
              address: "仙林校区",
              logoUrl: "https://example.com/logo.png",
              themeColor: "#0071e3",
            },
            status: "ERRAND_DEMAND_STATUS_OPEN",
            productTemplates: [
              {
                id: "1001",
                title: "SAST 贴纸",
                description: "社团周边",
                priceCents: 1599,
                storeId: "3001",
                mainImageUrl: "https://example.com/sticker.png",
                barcode: "690000000001",
                updatedAt: "2026-06-09T08:00:00Z",
              },
            ],
            totalOriginAmountCents: 3198,
            totalActualAmountCents: 2998,
            totalServiceFeeCents: 600,
            productTotalCount: 2,
          },
        ],
        currentPage: 1,
        totalCount: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const orders = await listBuyerErrandOrders({
      ...localOptions,
      storeId: "3001",
      status: "open",
      page: 1,
      pageSize: 20,
    });

    expect(orders).toEqual([
      {
        id: "9001",
        storeId: "3001",
        createdAt: "2026-06-09T08:30:00.000Z",
        store: {
          id: "3001",
          name: "SAST 小卖部",
          address: "仙林校区",
          logoUrl: "https://example.com/logo.png",
          themeColor: "#0071e3",
        },
        status: "open",
        productTemplates: [
          {
            id: "1001",
            title: "SAST 贴纸",
            description: "社团周边",
            priceCents: 1599,
            storeId: "3001",
            mainImageUrl: "https://example.com/sticker.png",
            barcode: "690000000001",
            updatedAt: "2026-06-09T08:00:00.000Z",
          },
        ],
        totalOriginAmountCents: 3198,
        totalActualAmountCents: 2998,
        totalServiceFeeCents: 600,
        productTotalCount: 2,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.BuyerErrandOrderService/GetBuyerErrandOrderBrief",
      body: {
        page: 1,
        pageSize: 20,
        storeIdFilter: "3001",
        statusFilter: "ERRAND_DEMAND_STATUS_OPEN",
      },
    });
  });

  it("validates list buyer errand order filters before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listBuyerErrandOrders({ ...localOptions, storeId: "0" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listBuyerErrandOrders({
        ...localOptions,
        storeId: "9223372036854775808",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listBuyerErrandOrders({ ...localOptions, page: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listBuyerErrandOrders({ ...localOptions, pageSize: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      listBuyerErrandOrders({
        ...localOptions,
        status: "unknown" as BuyerErrandOrderStatusFilter,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws for remote list mode before backend client is wired", async () => {
    await expect(
      listBuyerErrandOrders({ dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("throws for remote detail mode before backend client is wired", async () => {
    await expect(
      getBuyerErrandOrderDetail("9001", { dataSource: "remote" }),
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
