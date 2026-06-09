import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { FeatureUnavailableError, ValidationError } from "../errors"
import {
  listBuyerErrandOrders,
  type BuyerErrandOrder,
  type BuyerErrandOrderStatusFilter,
} from "./buyer-errand-orders"

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

describe("buyer errand order service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes a stable buyer errand order return type", () => {
    expectTypeOf<ReturnType<typeof listBuyerErrandOrders>>().toEqualTypeOf<
      Promise<BuyerErrandOrder[]>
    >()
  })

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
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const orders = await listBuyerErrandOrders({
      ...localOptions,
      storeId: "3001",
      status: "open",
      page: 1,
      pageSize: 20,
    })

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
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.errand.v1.BuyerErrandOrderService/GetBuyerErrandOrderBrief",
      body: {
        page: 1,
        pageSize: 20,
        storeIdFilter: "3001",
        statusFilter: "ERRAND_DEMAND_STATUS_OPEN",
      },
    })
  })

  it("validates list buyer errand order filters before submitting requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      listBuyerErrandOrders({ ...localOptions, storeId: "0" })
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      listBuyerErrandOrders({
        ...localOptions,
        storeId: "9223372036854775808",
      })
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      listBuyerErrandOrders({ ...localOptions, page: 0 })
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      listBuyerErrandOrders({ ...localOptions, pageSize: 0 })
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      listBuyerErrandOrders({
        ...localOptions,
        status: "unknown" as BuyerErrandOrderStatusFilter,
      })
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws for remote list mode before backend client is wired", async () => {
    await expect(
      listBuyerErrandOrders({ dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
  })
})

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  })
}

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string
    body: Record<string, unknown>
  }
) {
  const [input, init] = fetchMock.mock.calls[0] ?? []
  const url = typeof input === "string" ? input : (input as Request).url
  const body =
    typeof input === "string" ? init?.body : await (input as Request).clone().text()

  expect(new URL(url).pathname).toBe(expected.path)
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body)
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body)
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body)
  }

  return String(body)
}
