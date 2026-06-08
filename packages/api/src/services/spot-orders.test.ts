import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors"
import {
  createSpotOrders,
  listSpotOrders,
  type CreateSpotOrderInput,
  type SpotOrder,
} from "./spot-orders"

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

const validInput: CreateSpotOrderInput = {
  spotGoodsId: "2001",
  quantity: 2,
  updatedAt: "1970-01-01T00:00:02.000Z",
}

describe("spot order service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable spot order return types", () => {
    expectTypeOf<ReturnType<typeof listSpotOrders>>().toEqualTypeOf<
      Promise<SpotOrder[]>
    >()
    expectTypeOf<ReturnType<typeof createSpotOrders>>().toEqualTypeOf<
      Promise<SpotOrder[]>
    >()
  })

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
            status: 1,
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const orders = await createSpotOrders([validInput], localOptions)

    expect(orders).toEqual([
      expect.objectContaining({
        id: "5001",
        orderNo: "SO202606080001",
        productTitle: "SAST 贴纸",
        quantity: 2,
        totalAmountCents: 2598,
        status: "pending_payment",
      }),
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
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
    })
  })

  it("validates create spot order input before submitting requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(createSpotOrders([], localOptions)).rejects.toBeInstanceOf(
      ValidationError
    )
    await expect(
      createSpotOrders([{ ...validInput, spotGoodsId: "0" }], localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotOrders([{ ...validInput, quantity: 0 }], localOptions)
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createSpotOrders([validInput], { dataSource: "local" })
    ).rejects.toBeInstanceOf(ApiConfigurationError)
  })

  it("wraps local create failures in an API request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          {
            code: "unavailable",
            message: "backend unavailable",
          },
          { status: 503 }
        )
      )
    )

    await expect(createSpotOrders([validInput], localOptions)).rejects.toBeInstanceOf(
      ApiRequestError
    )
  })

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createSpotOrders([validInput], { dataSource: "remote" })
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
