import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
  ValidationError,
} from "../errors";
import {
  createSpotGoods,
  getSpotGoods,
  listSpotGoods,
  type CreateSpotGoodsInput,
  type CreatedSpotGoods,
  type SpotGoods,
  type SpotGoodsBrief,
} from "./spot-goods";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

const validInput: CreateSpotGoodsInput = {
  productTemplateId: "1001",
  salePriceCents: 1299,
  stockTotal: 8,
  productTemplateUpdatedAt: "1970-01-01T00:00:01.000Z",
};

describe("spot goods service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable spot goods return types", () => {
    expectTypeOf<ReturnType<typeof listSpotGoods>>().toEqualTypeOf<
      Promise<{
        goods: SpotGoodsBrief[];
        currentPage: number;
        totalCount: number;
        pageSize: number;
      }>
    >();
    expectTypeOf<ReturnType<typeof createSpotGoods>>().toEqualTypeOf<
      Promise<CreatedSpotGoods>
    >();
    expectTypeOf<ReturnType<typeof getSpotGoods>>().toEqualTypeOf<
      Promise<SpotGoods>
    >();
  });

  it("lists the global page by querying each store", async () => {
    const listRequestBodies: unknown[] = [];
    const fetchMock = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
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

        if (pathname.includes("ListSpotGoods")) {
          listRequestBodies.push(await readRequestBody(input, init));
          return stubJsonResponse({
            spotGoodsList: [
              {
                id: "6001",
                productTemplate: {
                  id: "4001",
                  title: "矿泉水",
                  storeId: "3001",
                },
                salePriceCents: 200,
              },
              {
                id: "6002",
                productTemplate: {
                  id: "4002",
                  title: "纸巾",
                  storeId: "3002",
                },
                salePriceCents: 600,
              },
            ],
            currentPage: 1,
            totalCount: 2,
          });
        }

        throw new Error(`unexpected request: ${pathname}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSpotGoods(localOptions);

    expect(result).toMatchObject({
      currentPage: 1,
      totalCount: 2,
      pageSize: 50,
    });
    expect(result.goods.map((item) => item.id)).toEqual(["6001", "6002"]);
    expect(result.goods[0]?.store).toMatchObject({
      id: "3001",
      name: "SAST 小卖部",
    });
    expect(result.goods[0]).not.toHaveProperty("stock");
    expect(result.goods[0]).not.toHaveProperty("sellerId");
    expect(listRequestBodies).toEqual([{ page: 1, pageSize: 50 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("supports an explicit positive store filter and requested page size", async () => {
    const listRequestBodies: unknown[] = [];
    const fetchMock = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const pathname = new URL(url).pathname;

        if (pathname.includes("GetStoreList")) {
          return stubJsonResponse({
            stores: [{ id: "3001", name: "SAST 小卖部" }],
          });
        }

        if (pathname.includes("ListSpotGoods")) {
          listRequestBodies.push(await readRequestBody(input, init));
          return stubJsonResponse({
            spotGoodsList: [
              {
                id: "6001",
                productTemplate: {
                  id: "4001",
                  title: "矿泉水",
                  storeId: "3001",
                },
                salePriceCents: 200,
              },
            ],
            currentPage: 2,
            totalCount: 21,
          });
        }

        throw new Error(`unexpected request: ${pathname}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSpotGoods({
      ...localOptions,
      storeId: "3001",
      page: 2,
      pageSize: 20,
    });

    expect(result).toMatchObject({
      currentPage: 2,
      totalCount: 21,
      pageSize: 20,
    });
    expect(result.goods).toHaveLength(1);
    expect(result.goods[0]?.store.id).toBe("3001");
    expect(listRequestBodies).toEqual([
      { storeId: "3001", page: 2, pageSize: 20 },
    ]);
  });

  it("accepts an explicit store_id=0 global filter", async () => {
    const listRequestBodies: unknown[] = [];
    const fetchMock = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const pathname = new URL(url).pathname;

        if (pathname.includes("GetStoreList")) {
          return stubJsonResponse({ stores: [] });
        }

        if (pathname.includes("ListSpotGoods")) {
          listRequestBodies.push(await readRequestBody(input, init));
          return stubJsonResponse({
            spotGoodsList: [],
            currentPage: 1,
            totalCount: 0,
          });
        }

        throw new Error(`unexpected request: ${pathname}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listSpotGoods({ ...localOptions, storeId: "0" }),
    ).resolves.toEqual({
      goods: [],
      currentPage: 1,
      totalCount: 0,
      pageSize: 50,
    });
    expect(listRequestBodies).toEqual([{ page: 1, pageSize: 50 }]);
  });

  it.each([
    [
      "a mismatched current page",
      { page: 2, pageSize: 20 },
      { spotGoodsList: [], currentPage: 1, totalCount: 21 },
    ],
    [
      "more items than the requested page size",
      { page: 1, pageSize: 1 },
      {
        spotGoodsList: [
          {
            id: "6001",
            productTemplate: {
              id: "4001",
              title: "矿泉水",
              storeId: "3001",
            },
            salePriceCents: 200,
          },
          {
            id: "6002",
            productTemplate: {
              id: "4002",
              title: "纸巾",
              storeId: "3001",
            },
            salePriceCents: 600,
          },
        ],
        currentPage: 1,
        totalCount: 2,
      },
    ],
    [
      "a total count smaller than the page offset",
      { page: 2, pageSize: 20 },
      {
        spotGoodsList: [
          {
            id: "6001",
            productTemplate: {
              id: "4001",
              title: "矿泉水",
              storeId: "3001",
            },
            salePriceCents: 200,
          },
        ],
        currentPage: 2,
        totalCount: 1,
      },
    ],
  ])(
    "rejects invalid pagination metadata: %s",
    async (_, options, response) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | Request) => {
          const url = typeof input === "string" ? input : input.url;
          const pathname = new URL(url).pathname;
          if (pathname.includes("GetStoreList")) {
            return stubJsonResponse({
              stores: [{ id: "3001", name: "SAST 小卖部" }],
            });
          }
          if (pathname.includes("ListSpotGoods")) {
            return stubJsonResponse(response);
          }
          throw new Error(`unexpected request: ${pathname}`);
        }),
      );

      await expect(
        listSpotGoods({ ...localOptions, ...options }),
      ).rejects.toBeInstanceOf(FeatureUnavailableError);
    },
  );

  it.each([
    ["negative store ID", { storeId: "-1" }],
    ["non-integer store ID", { storeId: "1.5" }],
    ["empty store ID", { storeId: "" }],
    ["non-numeric store ID", { storeId: "store" }],
    ["non-canonical store ID", { storeId: "01" }],
    ["overflowing store ID", { storeId: "9223372036854775808" }],
    ["zero page", { page: 0 }],
    ["negative page", { page: -1 }],
    ["fractional page", { page: 1.5 }],
    ["zero page size", { pageSize: 0 }],
    ["negative page size", { pageSize: -1 }],
    ["fractional page size", { pageSize: 1.5 }],
  ])("rejects invalid list option: %s", async (_, invalidOptions) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listSpotGoods({ ...localOptions, ...invalidOptions }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails when a global result cannot be mapped to a known store", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      const pathname = new URL(url).pathname;

      if (pathname.includes("GetStoreList")) {
        return stubJsonResponse({
          stores: [{ id: "3001", name: "SAST 小卖部" }],
        });
      }

      if (pathname.includes("ListSpotGoods")) {
        return stubJsonResponse({
          spotGoodsList: [
            {
              id: "6001",
              productTemplate: {
                id: "4001",
                title: "未知店铺商品",
                storeId: "9999",
              },
              salePriceCents: 200,
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      throw new Error(`unexpected request: ${pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSpotGoods(localOptions)).rejects.toBeInstanceOf(
      FeatureUnavailableError,
    );
  });

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
          seller: {
            id: "42",
            name: "SAST 小卖部",
            avatarUrl: "https://example.test/seller.png",
          },
          updatedAt: "2026-07-18T02:00:00Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const goods = await getSpotGoods("6001", localOptions);

    expect(goods).toMatchObject({
      id: "6001",
      product: { id: "4001", title: "农夫山泉矿泉水" },
      salePriceCents: 200,
      stock: 12,
      sellerId: "42",
      sellerAvatarUrl: "https://example.test/seller.png",
      updatedAt: "2026-07-18T02:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/GetSpotGoods",
      body: { spotGoodsId: "6001" },
    });
  });

  it("does not expose goods without a product template", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "6001",
          salePriceCents: 200,
          stock: 12,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSpotGoods("6001", localOptions)).rejects.toBeInstanceOf(
      FeatureUnavailableError,
    );
  });

  it.each([
    ["seller", { updatedAt: "2026-07-18T02:00:00Z" }],
    ["updatedAt", { seller: { id: "42", name: "SAST 小卖部" } }],
  ])("rejects goods without required %s details", async (_, partial) => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "6001",
          productTemplate: { id: "4001", title: "矿泉水" },
          salePriceCents: 200,
          stock: 12,
          ...partial,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSpotGoods("6001", localOptions)).rejects.toBeInstanceOf(
      FeatureUnavailableError,
    );
  });

  it("validates spot goods IDs before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const id of ["", "0", "01", "-1", "9223372036854775808"]) {
      await expect(getSpotGoods(id, localOptions)).rejects.toBeInstanceOf(
        ValidationError,
      );
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

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
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const goods = await createSpotGoods(validInput, localOptions);

    expect(goods).toMatchObject({
      id: "2001",
      salePriceCents: 1299,
      stock: 8,
      createdAt: null,
      updatedAt: "1970-01-01T00:00:02.000Z",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/CreateSpotGoods",
      body: {
        productTemplateId: "1001",
        salePriceCents: 1299,
        stockTotal: 8,
        productTemplateUpdatedAt: "1970-01-01T00:00:01Z",
      },
    });
  });

  it("accepts a sparse spot goods detail from the create backend", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "6",
          salePriceCents: 3900,
          createdAt: "2026-08-01T08:22:24.069210Z",
          updatedAt: "2026-08-01T08:22:24.069210Z",
          stock: 1,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const goods = await createSpotGoods(
      {
        ...validInput,
        salePriceCents: 3900,
        stockTotal: 1,
        productTemplateId: "93009",
        productTemplateUpdatedAt: "2026-07-31T17:13:51.808197Z",
      },
      localOptions,
    );

    expect(goods).toMatchObject({
      id: "6",
      salePriceCents: 3900,
      stock: 1,
      createdAt: "2026-08-01T08:22:24.06921Z",
      updatedAt: "2026-08-01T08:22:24.06921Z",
    });
  });

  it("preserves a nanosecond template version when creating spot goods", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "2001",
          productTemplate: { id: "1001" },
          salePriceCents: 1299,
          stock: 8,
          seller: { id: "42", name: "南邮同学" },
          updatedAt: "1970-01-01T00:00:02Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createSpotGoods(
      {
        ...validInput,
        productTemplateUpdatedAt: "1970-01-01T00:00:01.123456789Z",
      },
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/CreateSpotGoods",
      body: {
        productTemplateId: "1001",
        salePriceCents: 1299,
        stockTotal: 8,
        productTemplateUpdatedAt: "1970-01-01T00:00:01.123456789Z",
      },
    });
  });

  it("validates create spot goods input before submitting requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSpotGoods({ ...validInput, productTemplateId: "0" }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods(
        { ...validInput, productTemplateId: "9223372036854775808" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods({ ...validInput, salePriceCents: 0 }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods(
        { ...validInput, salePriceCents: 2147483648 },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods({ ...validInput, stockTotal: 0 }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods({ ...validInput, stockTotal: 2147483648 }, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods(
        { ...validInput, productTemplateUpdatedAt: "not-a-date" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSpotGoods(
        { ...validInput, productTemplateUpdatedAt: null },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a configured Connect base URL for local create mode", async () => {
    await expect(
      createSpotGoods({ ...validInput }, { dataSource: "local" }),
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
      createSpotGoods(validInput, localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("throws for remote create mode before backend client is wired", async () => {
    await expect(
      createSpotGoods(validInput, { dataSource: "remote" }),
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

async function readRequestBody(
  input: string | Request,
  init?: RequestInit,
): Promise<unknown> {
  const body =
    typeof input === "string" ? init?.body : await input.clone().text();
  return JSON.parse(bodyToText(body));
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
