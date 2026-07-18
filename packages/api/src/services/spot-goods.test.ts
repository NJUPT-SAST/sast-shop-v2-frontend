import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors"
import {
  createSpotGoods,
  getSpotGoods,
  listSpotGoods,
  type CreateSpotGoodsInput,
  type SpotGoods,
} from "./spot-goods"

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
}

const validInput: CreateSpotGoodsInput = {
  productTemplateId: "1001",
  salePriceCents: 1299,
  stockTotal: 8,
  productTemplateUpdatedAt: "1970-01-01T00:00:01.000Z",
}

describe("spot goods service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable spot goods return types", () => {
    expectTypeOf<ReturnType<typeof listSpotGoods>>().toEqualTypeOf<
      Promise<SpotGoods[]>
    >()
    expectTypeOf<ReturnType<typeof createSpotGoods>>().toEqualTypeOf<
      Promise<SpotGoods>
    >()
    expectTypeOf<ReturnType<typeof getSpotGoods>>().toEqualTypeOf<
      Promise<SpotGoods>
    >()
  })

  it("deduplicates goods returned by multiple store queries", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const url = typeof input === "string" ? input : input.url
      const pathname = new URL(url).pathname

      if (pathname.includes("GetStoreList")) {
        return stubJsonResponse({
          stores: [
            { id: "3001", name: "SAST 小卖部" },
            { id: "3002", name: "南邮校园超市" },
          ],
        })
      }

      if (pathname.includes("ListSpotGoods")) {
        return stubJsonResponse({
          spotGoodsList: [
            {
              id: "6001",
              productTemplate: { id: "4001", title: "矿泉水" },
              salePriceCents: 200,
            },
          ],
        })
      }

      return stubJsonResponse({
        spotGoodsDetail: {
          id: "6001",
          productTemplate: { id: "4001", title: "矿泉水" },
          salePriceCents: 200,
          stock: 12,
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const goods = await listSpotGoods(localOptions)

    expect(goods.map((item) => item.id)).toEqual(["6001"])
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("gets spot goods details through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "6001",
          productTemplate: {
            id: "4001",
            title: "农夫山泉矿泉水",
            description: "550ml 瓶装水",
            priceCents: 250,
            storeId: "3001",
            updatedAt: "2026-07-18T01:00:00Z",
          },
          salePriceCents: 200,
          stock: 12,
          seller: { id: "42", name: "SAST 小卖部" },
          updatedAt: "2026-07-18T02:00:00Z",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const goods = await getSpotGoods("6001", localOptions)

    expect(goods).toMatchObject({
      id: "6001",
      product: { id: "4001", title: "农夫山泉矿泉水" },
      salePriceCents: 200,
      stock: 12,
      sellerId: "42",
      updatedAt: "2026-07-18T02:00:00.000Z",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/GetSpotGoods",
      body: { spotGoodsId: "6001" },
    })
  })

  it("validates spot goods IDs before submitting requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    for (const id of ["", "0", "01", "-1", "9223372036854775808"]) {
      await expect(getSpotGoods(id, localOptions)).rejects.toBeInstanceOf(
        ValidationError
      )
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("creates spot goods through the local Connect backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "2001",
          productTemplate: {
            id: "1001",
            title: "SAST 贴纸",
            description: "社团周边",
            priceCents: 1599,
            storeId: "3001",
            mainImageUrl: "https://example.com/sticker.png",
            barcode: "690000000001",
            updatedAt: "1970-01-01T00:00:01Z",
          },
          salePriceCents: 1299,
          stock: 8,
          seller: {
            id: "42",
            name: "南邮同学",
          },
          updatedAt: "1970-01-01T00:00:02Z",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const goods = await createSpotGoods(validInput, localOptions)

    expect(goods).toMatchObject({
      id: "2001",
      salePriceCents: 1299,
      stock: 8,
      sellerId: "42",
      sellerName: "南邮同学",
      product: {
        id: "1001",
        title: "SAST 贴纸",
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/CreateSpotGoods",
      body: {
        productTemplateId: "1001",
        salePriceCents: 1299,
        stockTotal: 8,
        productTemplateUpdatedAt: "1970-01-01T00:00:01Z",
      },
    })
  })

  it("preserves a nanosecond template version when creating spot goods", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "2001",
          productTemplate: { id: "1001" },
          salePriceCents: 1299,
          stock: 8,
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await createSpotGoods(
      {
        ...validInput,
        productTemplateUpdatedAt: "1970-01-01T00:00:01.123456789Z",
      },
      localOptions
    )

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/CreateSpotGoods",
      body: {
        productTemplateId: "1001",
        salePriceCents: 1299,
        stockTotal: 8,
        productTemplateUpdatedAt: "1970-01-01T00:00:01.123456789Z",
      },
    })
  })

  it("validates create spot goods input before submitting requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createSpotGoods({ ...validInput, productTemplateId: "0" }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods(
        { ...validInput, productTemplateId: "9223372036854775808" },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods({ ...validInput, salePriceCents: 0 }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods(
        { ...validInput, salePriceCents: 2147483648 },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods({ ...validInput, stockTotal: 0 }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods({ ...validInput, stockTotal: 2147483648 }, localOptions)
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods(
        { ...validInput, productTemplateUpdatedAt: "not-a-date" },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      createSpotGoods(
        { ...validInput, productTemplateUpdatedAt: null },
        localOptions
      )
    ).rejects.toBeInstanceOf(ValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createSpotGoods({ ...validInput }, { dataSource: "local" })
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

    await expect(createSpotGoods(validInput, localOptions)).rejects.toBeInstanceOf(
      ApiRequestError
    )
  })

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createSpotGoods(validInput, { dataSource: "remote" })
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
