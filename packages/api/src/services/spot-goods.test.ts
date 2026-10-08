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
  listSellerSpotGoods,
  updateSpotGoodsPrice,
  updateSpotGoodsStock,
  UpdatedSpotGoodsRefreshError,
  type CreateSpotGoodsInput,
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
      Promise<SpotGoods>
    >();
    expectTypeOf<ReturnType<typeof getSpotGoods>>().toEqualTypeOf<
      Promise<SpotGoods>
    >();
  });

  it("lists the global page with one store_id=0 request", async () => {
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
                stock: 0,
              },
              {
                id: "6002",
                productTemplate: {
                  id: "4002",
                  title: "纸巾",
                  storeId: "3002",
                },
                salePriceCents: 600,
                stock: 9,
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
      pageSize: 30,
    });
    expect(result.goods.map((item) => item.id)).toEqual(["6001", "6002"]);
    expect(result.goods[0]?.store).toMatchObject({
      id: "3001",
      name: "SAST 小卖部",
    });
    expect(result.goods.map((item) => item.stock)).toEqual([0, 9]);
    expect(result.goods[0]).not.toHaveProperty("sellerId");
    expect(listRequestBodies).toEqual([{ page: 1, pageSize: 30 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("searches server-side and preserves matching pagination", async () => {
    const requests: unknown[] = [];
    const fetchMock = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
        const pathname = new URL(typeof input === "string" ? input : input.url)
          .pathname;
        if (pathname.includes("GetStoreList"))
          return stubJsonResponse({ stores: [] });
        requests.push(await readRequestBody(input, init));
        return stubJsonResponse({
          spotGoodsList: [],
          currentPage: 2,
          totalCount: 60,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = await listSpotGoods({
      ...localOptions,
      keyword: "  ABC_%  ",
      page: 2,
    });
    expect(page).toMatchObject({
      currentPage: 2,
      totalCount: 60,
      pageSize: 30,
    });
    expect(requests).toEqual([{ page: 2, pageSize: 30, keyword: "ABC_%" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lists the authenticated seller in one paginated RPC and keeps zero stock", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsList: [
          {
            id: "6001",
            productTemplate: { id: "4001", storeId: "3001" },
            seller: { id: "42" },
            stock: 0,
            salePriceCents: 299,
            updatedAt: "2026-07-18T02:00:00.123456789Z",
          },
        ],
        currentPage: 2,
        totalCount: 21,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = await listSellerSpotGoods(
      { sellerId: "42", page: 2, pageSize: 20 },
      localOptions,
    );
    expect(page).toMatchObject({
      currentPage: 2,
      pageSize: 20,
      totalCount: 21,
      goods: [
        {
          id: "6001",
          sellerId: "42",
          stock: 0,
          updatedAt: "2026-07-18T02:00:00.123456789Z",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/ListMySpotGoods",
      body: { page: 2, pageSize: 20 },
    });
  });

  it("rejects another seller's response rather than displaying it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          spotGoodsList: [
            {
              id: "6001",
              productTemplate: { id: "4001" },
              seller: { id: "43" },
              updatedAt: "2026-07-18T02:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        }),
      ),
    );
    await expect(
      listSellerSpotGoods({ sellerId: "42" }, localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("accepts a page past the last owned listing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({ spotGoodsList: [], currentPage: 2, totalCount: 2 }),
      ),
    );
    await expect(
      listSellerSpotGoods({ sellerId: "42", page: 2 }, localOptions),
    ).resolves.toEqual({
      goods: [],
      currentPage: 2,
      pageSize: 20,
      totalCount: 2,
    });
  });

  it.each([
    { sellerId: "0" },
    { sellerId: "01" },
    { sellerId: "9223372036854775808" },
    { sellerId: "42", page: 0 },
    { sellerId: "42", pageSize: 0 },
    { sellerId: "42", pageSize: 101 },
  ])("rejects invalid seller list inputs before RPC: %j", async (input) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      listSellerSpotGoods(input, localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { currentPage: 2, totalCount: 0 },
    { currentPage: 1, totalCount: -1 },
    {
      currentPage: 1,
      totalCount: 0,
      spotGoodsList: [
        {
          id: "6001",
          productTemplate: { id: "4001" },
          seller: { id: "42" },
          updatedAt: "2026-07-18T02:00:00Z",
        },
      ],
    },
  ])("rejects invalid seller pagination: %j", async (response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse(response)),
    );
    await expect(
      listSellerSpotGoods({ sellerId: "42" }, localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("surfaces a seller list failure and leaves remote mode unavailable", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse(
        { code: "unavailable", message: "seller list failed" },
        { status: 503 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      listSellerSpotGoods({ sellerId: "42" }, localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
    await expect(
      listSellerSpotGoods({ sellerId: "42" }, { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects an oversized keyword before requesting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      listSpotGoods({ ...localOptions, keyword: "水".repeat(201) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
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
      pageSize: 30,
    });
    expect(listRequestBodies).toEqual([{ page: 1, pageSize: 30 }]);
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
      sellerId: "42",
      sellerName: "南邮同学",
      sellerAvatarUrl: "",
      product: {
        id: "1001",
        title: "SAST 贴纸",
      },
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

  it("creates the maximum inventory of 999 and keeps the returned inventory", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        spotGoodsDetail: {
          id: "2001",
          productTemplate: { id: "1001" },
          seller: { id: "42" },
          salePriceCents: validInput.salePriceCents,
          stock: 999,
          updatedAt: "1970-01-01T00:00:02.123456789Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const goods = await createSpotGoods(
      { ...validInput, stockTotal: 999 },
      localOptions,
    );

    expect(goods).toMatchObject({
      id: "2001",
      stock: 999,
      updatedAt: "1970-01-01T00:00:02.123456789Z",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.spot.v1.SpotGoodsService/CreateSpotGoods",
      body: {
        productTemplateId: "1001",
        salePriceCents: validInput.salePriceCents,
        stockTotal: 999,
        productTemplateUpdatedAt: "1970-01-01T00:00:01Z",
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
      createSpotGoods({ ...validInput, stockTotal: 1000 }, localOptions),
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

  it("updates the price with the full version and reloads the next stock version", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const fetchMock = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
        const path = new URL(typeof input === "string" ? input : input.url)
          .pathname;
        requests.push({ path, body: await readRequestBody(input, init) });
        if (path.endsWith("GetSpotGoods"))
          return stubJsonResponse({
            spotGoodsDetail: {
              id: "6001",
              productTemplate: { id: "4001" },
              seller: { id: "42" },
              salePriceCents: 299,
              stock: 7,
              updatedAt: "2026-07-18T02:00:01.987654321Z",
            },
          });
        return stubJsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const goods = await updateSpotGoodsPrice(
      {
        spotGoodsId: "6001",
        newSalePriceCents: 299,
        updatedAt: "2026-07-18T02:00:00.123456789Z",
      },
      localOptions,
    );
    expect(goods).toMatchObject({
      salePriceCents: 299,
      stock: 7,
      updatedAt: "2026-07-18T02:00:01.987654321Z",
    });
    await updateSpotGoodsStock(
      { spotGoodsId: goods.id, newStock: 0, updatedAt: goods.updatedAt },
      localOptions,
    );
    expect(requests).toEqual([
      {
        path: "/sast.sastshopv2.spot.v1.SpotGoodsService/UpdateSpotGoodsPrice",
        body: {
          spotGoodsId: "6001",
          newSalePriceCents: 299,
          updatedAt: "2026-07-18T02:00:00.123456789Z",
        },
      },
      {
        path: "/sast.sastshopv2.spot.v1.SpotGoodsService/GetSpotGoods",
        body: { spotGoodsId: "6001" },
      },
      {
        path: "/sast.sastshopv2.spot.v1.SpotGoodsService/UpdateSpotGoodsStock",
        body: {
          spotGoodsId: "6001",
          updatedAt: "2026-07-18T02:00:01.987654321Z",
        },
      },
      {
        path: "/sast.sastshopv2.spot.v1.SpotGoodsService/GetSpotGoods",
        body: { spotGoodsId: "6001" },
      },
    ]);
  });

  it.each([-1, 999])(
    "updates inventory to %s with the latest version and returns the refreshed goods",
    async (newStock) => {
      const requests: Array<{ path: string; body: unknown }> = [];
      const updatedAt = "2026-10-08T02:00:00.123456789Z";
      const nextUpdatedAt = "2026-10-08T02:00:01.987654321Z";
      const fetchMock = vi.fn(
        async (input: string | Request, init?: RequestInit) => {
          const path = new URL(typeof input === "string" ? input : input.url)
            .pathname;
          requests.push({ path, body: await readRequestBody(input, init) });
          if (path.endsWith("GetSpotGoods")) {
            return stubJsonResponse({
              spotGoodsDetail: {
                id: "6001",
                productTemplate: { id: "4001" },
                seller: { id: "42" },
                salePriceCents: 299,
                stock: newStock,
                updatedAt: nextUpdatedAt,
              },
            });
          }
          return stubJsonResponse({});
        },
      );
      vi.stubGlobal("fetch", fetchMock);

      const goods = await updateSpotGoodsStock(
        { spotGoodsId: "6001", newStock, updatedAt },
        localOptions,
      );

      expect(goods).toMatchObject({
        id: "6001",
        stock: newStock,
        updatedAt: nextUpdatedAt,
      });
      expect(requests).toEqual([
        {
          path: "/sast.sastshopv2.spot.v1.SpotGoodsService/UpdateSpotGoodsStock",
          body: { spotGoodsId: "6001", newStock, updatedAt },
        },
        {
          path: "/sast.sastshopv2.spot.v1.SpotGoodsService/GetSpotGoods",
          body: { spotGoodsId: "6001" },
        },
      ]);
    },
  );

  it.each(["price", "stock"] as const)(
    "distinguishes confirmed %s writes with a failed refresh",
    async (kind) => {
      const fetchMock = vi.fn(async (input: string | Request) => {
        const path = new URL(typeof input === "string" ? input : input.url)
          .pathname;
        if (path.endsWith("GetSpotGoods"))
          return stubJsonResponse(
            { code: "unavailable", message: "read failed" },
            { status: 503 },
          );
        return stubJsonResponse({});
      });
      vi.stubGlobal("fetch", fetchMock);
      const common = {
        spotGoodsId: "6001",
        updatedAt: "2026-07-18T02:00:00.123456789Z",
      };
      const promise =
        kind === "price"
          ? updateSpotGoodsPrice(
              { ...common, newSalePriceCents: 299 },
              localOptions,
            )
          : updateSpotGoodsStock({ ...common, newStock: 7 }, localOptions);
      await expect(promise).rejects.toBeInstanceOf(
        UpdatedSpotGoodsRefreshError,
      );
      await expect(promise).rejects.toMatchObject({
        spotGoodsId: "6001",
        cause: expect.any(ApiRequestError),
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["permission_denied", "aborted", "unavailable"])(
    "does not refresh or retry a rejected or uncertain write: %s",
    async (code) => {
      const fetchMock = vi.fn(async () =>
        stubJsonResponse(
          { code, message: "write failed" },
          {
            status:
              code === "permission_denied"
                ? 403
                : code === "aborted"
                  ? 409
                  : 503,
          },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        updateSpotGoodsPrice(
          {
            spotGoodsId: "6001",
            newSalePriceCents: 299,
            updatedAt: "2026-07-18T02:00:00Z",
          },
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ApiRequestError);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("reports a malformed refresh after a confirmed write separately", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse({})),
    );
    await expect(
      updateSpotGoodsStock(
        { spotGoodsId: "6001", newStock: 0, updatedAt: "2026-07-18T02:00:00Z" },
        localOptions,
      ),
    ).rejects.toMatchObject({
      name: "UpdatedSpotGoodsRefreshError",
      cause: expect.any(FeatureUnavailableError),
    });
  });

  it("validates both mutation inputs before requesting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const common = { spotGoodsId: "6001", updatedAt: "2026-07-18T02:00:00Z" };
    for (const newSalePriceCents of [0, -1, 1.5, NaN, 2147483648]) {
      await expect(
        updateSpotGoodsPrice({ ...common, newSalePriceCents }, localOptions),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    for (const newStock of [-2, 1.5, NaN, 1000, 2147483648]) {
      await expect(
        updateSpotGoodsStock({ ...common, newStock }, localOptions),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    for (const spotGoodsId of ["0", "01", "9223372036854775808"]) {
      await expect(
        updateSpotGoodsPrice(
          { ...common, spotGoodsId, newSalePriceCents: 1 },
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        updateSpotGoodsStock(
          { ...common, spotGoodsId, newStock: 1 },
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    for (const updatedAt of ["", "not-a-date", "2026-02-30T00:00:00Z"]) {
      await expect(
        updateSpotGoodsPrice(
          { ...common, updatedAt, newSalePriceCents: 1 },
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        updateSpotGoodsStock(
          { ...common, updatedAt, newStock: 1 },
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves remote updates unavailable", async () => {
    const common = { spotGoodsId: "6001", updatedAt: "2026-07-18T02:00:00Z" };
    await expect(
      updateSpotGoodsPrice(
        { ...common, newSalePriceCents: 1 },
        { dataSource: "remote" },
      ),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    await expect(
      updateSpotGoodsStock(
        { ...common, newStock: 0 },
        { dataSource: "remote" },
      ),
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
