import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  ApiRequestError,
  FeatureUnavailableError,
  ResourceNotFoundError,
  ValidationError,
} from "../errors";
import {
  createProductTemplate,
  deleteProductTemplate,
  getProductTemplate,
  getProductTemplatesByBarcode,
  listProductTemplates,
  listProductTemplatesPage,
  updateProductTemplate,
  type CreateProductTemplateInput,
  type DeleteProductTemplateInput,
  type ProductTemplate,
  type ProductTemplateMatch,
  type UpdateProductTemplateInput,
} from "./product-templates";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

const createInput: CreateProductTemplateInput = {
  storeId: "3001",
  title: "  矿泉水  ",
  description: "  550ml 瓶装水  ",
  priceCents: 200,
  mainImageUrl: "  https://example.test/water.png  ",
  barcode: "0690000000001",
};

describe("product template service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable mutation and barcode lookup types", () => {
    expectTypeOf<typeof getProductTemplate>().returns.toEqualTypeOf<
      Promise<ProductTemplate>
    >();
    expectTypeOf<typeof createProductTemplate>().returns.toEqualTypeOf<
      Promise<ProductTemplate>
    >();
    expectTypeOf<typeof updateProductTemplate>().returns.toEqualTypeOf<
      Promise<ProductTemplate>
    >();
    expectTypeOf<typeof deleteProductTemplate>().returns.toEqualTypeOf<
      Promise<void>
    >();
    expectTypeOf<typeof getProductTemplatesByBarcode>().returns.toEqualTypeOf<
      Promise<ProductTemplateMatch[]>
    >();
    expectTypeOf<typeof listProductTemplates>().returns.toEqualTypeOf<
      Promise<ProductTemplate[]>
    >();
    expectTypeOf<typeof listProductTemplatesPage>().returns.toEqualTypeOf<
      Promise<import("../pagination").PageResult<ProductTemplate>>
    >();
  });

  it("gets a template by ID using the public RPC and preserves precise version and money", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplate: {
          id: "4001",
          title: "矿泉水",
          description: "550ml",
          priceCents: 299,
          storeId: "3001",
          mainImageUrl: "https://example.test/water.png",
          barcode: "690000000001",
          updatedAt: "2026-07-18T02:00:00.123456789Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(getProductTemplate("4001", localOptions)).resolves.toEqual({
      id: "4001",
      title: "矿泉水",
      description: "550ml",
      priceCents: 299,
      storeId: "3001",
      mainImageUrl: "https://example.test/water.png",
      barcode: "690000000001",
      updatedAt: "2026-07-18T02:00:00.123456789Z",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/GetProductTemplate",
      body: { productTemplateId: "4001" },
    });
  });

  it.each(["", "0", "01", "-1", "9223372036854775808"])(
    "rejects an invalid template ID before requesting: %s",
    async (id) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(getProductTemplate(id, localOptions)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reports a missing template and a not-found RPC as resource errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(stubJsonResponse({}))
      .mockResolvedValueOnce(
        stubJsonResponse(
          { code: "not_found", message: "template missing" },
          { status: 404 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      getProductTemplate("4001", localOptions),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      getProductTemplate("4001", localOptions),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it.each([
    { id: "4002" },
    { storeId: "0" },
    { title: "" },
    { updatedAt: null },
    { priceCents: -1 },
  ])(
    "rejects incomplete or mismatched template details: %j",
    async (partial) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          stubJsonResponse({
            productTemplate: {
              id: "4001",
              title: "矿泉水",
              priceCents: 200,
              storeId: "3001",
              updatedAt: "2026-07-18T02:00:00Z",
              ...partial,
            },
          }),
        ),
      );
      await expect(
        getProductTemplate("4001", localOptions),
      ).rejects.toBeInstanceOf(FeatureUnavailableError);
    },
  );

  it("surfaces detail request failures and keeps remote mode unavailable", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse(
        { code: "unavailable", message: "catalog unavailable" },
        { status: 503 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      getProductTemplate("4001", localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
    await expect(
      getProductTemplate("4001", { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("lists a product template page with preserved metadata", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplates: [
          {
            id: "4001",
            title: "矿泉水",
            priceCents: 200,
            storeId: "3001",
            barcode: "690000000001",
            mainImageUrl: "https://example.test/water.png",
          },
        ],
        currentPage: 1,
        totalCount: 21,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await listProductTemplatesPage({
      ...localOptions,
      storeId: "3001",
      page: 1,
      pageSize: 20,
    });

    expect(page).toMatchObject({
      currentPage: 1,
      pageSize: 20,
      totalCount: 21,
      hasMore: true,
    });
    expect(page.items.map((template) => template.id)).toEqual(["4001"]);
    expect(page.items[0]?.mainImageUrl).toBe("https://example.test/water.png");
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/GetProductTemplateList",
      body: { storeId: "3001", page: 1, pageSize: 20 },
    });
  });

  it("searches across stores using one globally paginated request", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplates: [{ id: "4051", title: "矿泉水", storeId: "3002" }],
        currentPage: 2,
        totalCount: 102,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = await listProductTemplatesPage({
      ...localOptions,
      page: 2,
      pageSize: 50,
      keyword: "  矿泉水  ",
    });
    expect(page.items.map((item) => item.id)).toEqual(["4051"]);
    expect(page).toMatchObject({
      currentPage: 2,
      totalCount: 102,
      hasMore: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/GetProductTemplateList",
      body: { page: 2, pageSize: 50, keyword: "矿泉水" },
    });
  });

  it("rejects a page inconsistent with the matching total", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          productTemplates: [{ id: "4051", title: "矿泉水", storeId: "3001" }],
          currentPage: 2,
          totalCount: 1,
        }),
      ),
    );
    await expect(
      listProductTemplatesPage({
        ...localOptions,
        page: 2,
        pageSize: 50,
        keyword: "水",
      }),
    ).rejects.toThrow("listProductTemplates.pagination");
  });

  it("rejects an oversized keyword before requesting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      listProductTemplatesPage({ ...localOptions, keyword: "水".repeat(201) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a normalized product template and maps the complete response", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplate: {
          id: "4001",
          title: "矿泉水",
          description: "550ml 瓶装水",
          priceCents: 200,
          storeId: "3001",
          mainImageUrl: "https://example.test/water.png",
          barcode: "0690000000001",
          updatedAt: "2026-07-18T01:00:00.123456789Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const template = await createProductTemplate(createInput, localOptions);

    expect(template).toEqual({
      id: "4001",
      title: "矿泉水",
      description: "550ml 瓶装水",
      priceCents: 200,
      storeId: "3001",
      mainImageUrl: "https://example.test/water.png",
      barcode: "0690000000001",
      updatedAt: "2026-07-18T01:00:00.123456789Z",
    });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/CreateProductTemplate",
      body: {
        storeId: "3001",
        title: "矿泉水",
        description: "550ml 瓶装水",
        priceCents: 200,
        mainImageUrl: "https://example.test/water.png",
        barcode: "0690000000001",
      },
    });
  });

  it.each([
    [{ ...createInput, storeId: "" }, "店铺 ID 不正确"],
    [{ ...createInput, storeId: "0" }, "店铺 ID 不正确"],
    [{ ...createInput, storeId: "01" }, "店铺 ID 不正确"],
    [{ ...createInput, storeId: "9223372036854775808" }, "店铺 ID 不正确"],
    [{ ...createInput, title: " " }, "商品名称不能为空"],
    [{ ...createInput, barcode: " " }, "商品条码不能为空"],
    [{ ...createInput, barcode: "6900A" }, "商品条码只能包含数字"],
    [{ ...createInput, priceCents: 0 }, "商品价格不正确"],
    [{ ...createInput, priceCents: 1.5 }, "商品价格不正确"],
    [{ ...createInput, priceCents: 2147483648 }, "商品价格不正确"],
    [
      { ...createInput, mainImageUrl: "javascript:alert(1)" },
      "商品图片地址不正确",
    ],
    [
      { ...createInput, mainImageUrl: "https://user:pass@example.test/a.png" },
      "商品图片地址不正确",
    ],
    [
      { ...createInput, mainImageUrl: "http://example.test/a.png" },
      "商品图片地址不正确",
    ],
    [
      { ...createInput, mainImageUrl: "https://127.0.0.1/a.png" },
      "商品图片地址不正确",
    ],
  ] as const)(
    "rejects invalid create input before requesting: %o",
    async (input, message) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createProductTemplate(
          input as CreateProductTemplateInput,
          localOptions,
        ),
      ).rejects.toThrow(message);
      await expect(
        createProductTemplate(
          input as CreateProductTemplateInput,
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("looks up every store match for a barcode and preserves leading zeroes", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        items: [
          {
            productTemplate: {
              id: "4001",
              title: "矿泉水",
              description: "550ml",
              priceCents: 200,
              storeId: "3001",
              barcode: "0690000000001",
              updatedAt: "2026-07-18T01:00:00Z",
            },
            store: {
              id: "3001",
              name: "SAST 小卖部",
              address: "仙林校区活动室",
            },
          },
          {
            productTemplate: {
              id: "4002",
              title: "矿泉水",
              description: "550ml",
              priceCents: 220,
              storeId: "3002",
              barcode: "0690000000001",
              updatedAt: "2026-07-18T01:00:00Z",
            },
            store: {
              id: "3002",
              name: "南门便利店",
              address: "仙林校区南门",
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const matches = await getProductTemplatesByBarcode(
      " 0690000000001 ",
      localOptions,
    );

    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.store?.name)).toEqual([
      "SAST 小卖部",
      "南门便利店",
    ]);
    expect(matches[0]?.productTemplate.barcode).toBe("0690000000001");
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/GetProductTemplateByBarcode",
      body: { barcode: "0690000000001" },
    });
  });

  it("returns an empty match list for an unknown barcode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse({ items: [] })),
    );

    await expect(
      getProductTemplatesByBarcode("690000000099", localOptions),
    ).resolves.toEqual([]);
  });

  it("fails closed when a barcode match omits its product template", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          items: [{ store: { id: "3001", name: "SAST 小卖部" } }],
        }),
      ),
    );

    await expect(
      getProductTemplatesByBarcode("690000000001", localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("fails closed for mismatched or duplicate store matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          items: [
            {
              productTemplate: {
                id: "4001",
                title: "矿泉水",
                priceCents: 200,
                storeId: "3001",
                barcode: "690000000001",
              },
              store: { id: "3002", name: "错误店铺" },
            },
          ],
        }),
      ),
    );

    await expect(
      getProductTemplatesByBarcode("690000000001", localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse({
          items: [
            {
              productTemplate: {
                id: "4001",
                title: "矿泉水",
                priceCents: 200,
                storeId: "3001",
                barcode: "690000000001",
              },
            },
            {
              productTemplate: {
                id: "4002",
                title: "重复矿泉水",
                priceCents: 220,
                storeId: "3001",
                barcode: "690000000001",
              },
            },
          ],
        }),
      ),
    );

    await expect(
      getProductTemplatesByBarcode("690000000001", localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it.each(["", " ", "6900A"])(
    "rejects invalid barcode lookup %o before requesting",
    async (barcode) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        getProductTemplatesByBarcode(barcode, localOptions),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("updates only explicit patch fields with the current version", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplate: {
          id: "4001",
          title: "天然矿泉水",
          description: "550ml",
          priceCents: 350,
          storeId: "3001",
          barcode: "0690000000001",
          updatedAt: "2026-07-18T02:00:00Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const input: UpdateProductTemplateInput = {
      id: "4001",
      updatedAt: "2026-07-18T01:00:00Z",
      patch: { title: "  天然矿泉水 ", priceCents: 350 },
    };
    const template = await updateProductTemplate(input, localOptions);

    expect(template.updatedAt).toBe("2026-07-18T02:00:00.000Z");
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/UpdateProductTemplate",
      body: {
        productTemplate: {
          id: "4001",
          title: "天然矿泉水",
          priceCents: 350,
          updatedAt: "2026-07-18T01:00:00Z",
        },
        updateMask: "title,priceCents",
      },
    });
  });

  it("preserves nanosecond versions when updating", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplate: {
          id: "4001",
          title: "矿泉水",
          priceCents: 200,
          storeId: "3001",
          barcode: "0690000000001",
          updatedAt: "2026-07-18T02:00:00.987654321Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const template = await updateProductTemplate(
      {
        id: "4001",
        updatedAt: "2026-07-18T01:00:00.123456789Z",
        patch: { title: "矿泉水" },
      },
      localOptions,
    );

    expect(template.updatedAt).toBe("2026-07-18T02:00:00.987654321Z");
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/UpdateProductTemplate",
      body: {
        productTemplate: {
          id: "4001",
          title: "矿泉水",
          updatedAt: "2026-07-18T01:00:00.123456789Z",
        },
        updateMask: "title",
      },
    });
  });

  it("deletes a product template by id", async () => {
    const fetchMock = vi.fn(async () => stubJsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await deleteProductTemplate({ id: "4001" }, localOptions);

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/DeleteProductTemplate",
      body: { productTemplateId: "4001" },
    });
  });

  it.each(["", "0", "01", "9223372036854775808"])(
    "rejects invalid delete id before requesting: %o",
    async (id) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        deleteProductTemplate(
          { id } as DeleteProductTemplateInput,
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an explicitly empty store filter", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listProductTemplates({ ...localOptions, storeId: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps explicit empty optional values in the update mask", async () => {
    const fetchMock = vi.fn(async () =>
      stubJsonResponse({
        productTemplate: {
          id: "4001",
          title: "矿泉水",
          priceCents: 200,
          storeId: "3001",
          barcode: "0690000000001",
          updatedAt: "2026-07-18T02:00:00Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateProductTemplate(
      {
        id: "4001",
        updatedAt: "2026-07-18T01:00:00Z",
        patch: { description: "", mainImageUrl: "" },
      },
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/UpdateProductTemplate",
      body: {
        productTemplate: {
          id: "4001",
          updatedAt: "2026-07-18T01:00:00Z",
        },
        updateMask: "description,mainImageUrl",
      },
    });
  });

  it.each([
    { id: "4001", updatedAt: "2026-07-18T01:00:00Z", patch: {} },
    { id: "0", updatedAt: "2026-07-18T01:00:00Z", patch: { title: "水" } },
    { id: "4001", updatedAt: "", patch: { title: "水" } },
    { id: "4001", updatedAt: "not-a-date", patch: { title: "水" } },
    { id: "4001", updatedAt: "2026-07-18T01:00:00Z", patch: { barcode: "" } },
  ] as const)(
    "rejects invalid update input before requesting: %o",
    async (input) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        updateProductTemplate(
          input as UpdateProductTemplateInput,
          localOptions,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("fails explicitly when create or update omits the returned template", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse({})),
    );

    await expect(
      createProductTemplate(createInput, localOptions),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    await expect(
      updateProductTemplate(
        {
          id: "4001",
          updatedAt: "2026-07-18T01:00:00Z",
          patch: { title: "新名称" },
        },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("keeps transport not-found and remote failures distinct", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          { code: "not_found", message: "template not found" },
          { status: 404 },
        ),
      ),
    );

    await expect(
      getProductTemplatesByBarcode("690000000001", localOptions),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      createProductTemplate(createInput, {
        dataSource: "remote",
      }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("wraps mutation transport failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        stubJsonResponse(
          { code: "unavailable", message: "backend unavailable" },
          { status: 503 },
        ),
      ),
    );

    await expect(
      createProductTemplate(createInput, localOptions),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });
});

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: { path: string; body: unknown },
) {
  const [input, init] = fetchMock.mock.calls.at(-1) ?? [];
  const url = typeof input === "string" ? input : (input as Request).url;
  const body =
    typeof input === "string"
      ? init?.body
      : await (input as Request).clone().text();

  expect(new URL(url).pathname).toBe(expected.path);
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body);
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  return String(body);
}

function stubJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
