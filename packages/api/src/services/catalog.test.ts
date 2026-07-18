import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { FeatureUnavailableError, ValidationError } from "../errors";
import type { ProductTemplate } from "./product-templates";
import { listProductTemplates } from "./product-templates";
import {
  createStore,
  listStores,
  type CreateStoreInput,
  type Store,
} from "./catalog";

const mockOptions = {
  dataSource: "mock" as const,
  connectBaseUrl: "http://127.0.0.1:6660",
};

describe("catalog service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes stable catalog return types", () => {
    expectTypeOf<typeof listStores>().returns.toEqualTypeOf<Promise<Store[]>>();
    expectTypeOf<typeof createStore>()
      .parameter(0)
      .toEqualTypeOf<CreateStoreInput>();
    expectTypeOf<typeof createStore>().returns.toEqualTypeOf<Promise<Store>>();
    expectTypeOf<typeof listProductTemplates>().returns.toEqualTypeOf<
      Promise<ProductTemplate[]>
    >();
  });

  it("creates a store through fauxrpc and maps the returned store", async () => {
    let requestBody: unknown;
    const fetchMock = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const pathname = new URL(url).pathname;

        if (pathname.includes("CreateStore")) {
          const body =
            input instanceof Request ? input.clone().body : init?.body;
          const text =
            typeof body === "string"
              ? body
              : ArrayBuffer.isView(body)
                ? new TextDecoder().decode(body)
                : "";
          requestBody = JSON.parse(text);
          return stubJsonResponse({
            store: {
              id: "3099",
              name: "SAST 新店",
              address: "仙林校区大学生活动中心",
              logoUrl: "https://example.test/store/new.png",
              themeColor: "#0071e3",
            },
          });
        }

        return stubJsonResponse(
          { code: "unimplemented", message: "unexpected request" },
          { status: 404 },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createStore(
        {
          name: "  SAST 新店  ",
          address: "  仙林校区大学生活动中心  ",
          logoUrl: "https://example.test/store/new.png",
          themeColor: "#0071e3",
        },
        mockOptions,
      ),
    ).resolves.toEqual({
      id: "3099",
      name: "SAST 新店",
      address: "仙林校区大学生活动中心",
      logoUrl: "https://example.test/store/new.png",
      themeColor: "#0071e3",
    });
    expect(requestBody).toEqual({
      name: "SAST 新店",
      address: "仙林校区大学生活动中心",
      logoUrl: "https://example.test/store/new.png",
      themeColor: "#0071e3",
    });
  });

  it("validates store creation input before requesting", async () => {
    await expect(
      createStore(
        { name: " ", address: "仙林校区", logoUrl: "", themeColor: "#0071e3" },
        mockOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createStore(
        { name: "新店", address: " ", logoUrl: "", themeColor: "#0071e3" },
        mockOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createStore(
        {
          name: "新店",
          address: "仙林校区",
          logoUrl: "not-a-url",
          themeColor: "#0071e3",
        },
        mockOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createStore(
        { name: "新店", address: "仙林校区", logoUrl: "", themeColor: "blue" },
        mockOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps store creation unavailable for the remote data source", async () => {
    await expect(
      createStore(
        {
          name: "新店",
          address: "仙林校区",
          logoUrl: "",
          themeColor: "#0071e3",
        },
        { dataSource: "remote" },
      ),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("rejects an incomplete create-store response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => stubJsonResponse({})),
    );

    await expect(
      createStore(
        {
          name: "新店",
          address: "仙林校区",
          logoUrl: "",
          themeColor: "#c9431f",
        },
        mockOptions,
      ),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("lists stores and product templates through fauxrpc in mock mode", async () => {
    const fetchMock = vi.fn(async (input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      const pathname = new URL(url).pathname;

      if (pathname.includes("GetStoreList")) {
        return stubJsonResponse({
          stores: [
            {
              id: "3001",
              name: "SAST 小卖部",
              address: "仙林校区活动室",
              logoUrl: "https://example.test/store/sast.png",
              themeColor: "#0071e3",
            },
          ],
        });
      }

      if (pathname.includes("GetProductTemplateList")) {
        return stubJsonResponse({
          productTemplates: [
            {
              id: "4001",
              title: "矿泉水",
              description: "550ml",
              priceCents: 200,
              storeId: "3001",
              mainImageUrl: "https://example.test/products/water.png",
              barcode: "690000000001",
              updatedAt: "2026-06-09T00:00:00Z",
            },
          ],
          currentPage: 1,
          totalCount: 1,
        });
      }

      return stubJsonResponse(
        { code: "unimplemented", message: "unexpected request" },
        { status: 404 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const [store] = await listStores(mockOptions);
    const templates = await listProductTemplates({
      ...mockOptions,
      storeId: store?.id,
    });

    expect(store).toMatchObject({
      id: "3001",
      name: "SAST 小卖部",
    });
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: "4001",
      storeId: "3001",
      title: "矿泉水",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("commits fauxrpc catalog stubs for group shop detail data", async () => {
    const catalogStub = await readFile(
      new URL("../../../../mock/fauxrpc/stubs/catalog.yaml", import.meta.url),
      "utf8",
    );

    expect(catalogStub).toContain(
      "target: sast.sastshopv2.catalog.v1.CatalogService/GetStoreList",
    );
    expect(catalogStub).toContain(
      "target: sast.sastshopv2.catalog.v1.CatalogService/CreateStore",
    );
    expect(catalogStub).toContain(
      "target: sast.sastshopv2.catalog.v1.ProductTemplateService/GetProductTemplateList",
    );
    expect(catalogStub).toContain("stores:");
    expect(catalogStub).toContain("productTemplates:");
    expect(catalogStub).toContain(
      "catalog-get-product-template-by-barcode-missing-store",
    );
    expect(catalogStub).toContain('storeId: "3001"');
    expect(catalogStub.match(/title: /g)?.length ?? 0).toBeGreaterThanOrEqual(
      9,
    );
  });

  it("commits fauxrpc errand task stubs for captain purchase data", async () => {
    const errandTaskStub = await readFile(
      new URL(
        "../../../../mock/fauxrpc/stubs/errand-task.yaml",
        import.meta.url,
      ),
      "utf8",
    );

    expect(errandTaskStub).toContain(
      "target: sast.sastshopv2.errand.v1.ErrandTaskService/GetErrandTaskList",
    );
    expect(errandTaskStub).toContain("errandTasks:");
    expect(errandTaskStub).toContain('taskId: "7001"');
    expect(errandTaskStub).toContain("status: ERRAND_TASK_STATUS_SHOPPING");
  });

  it("commits fauxrpc errand demand stubs for captain demand hall data", async () => {
    const errandDemandStub = await readFile(
      new URL(
        "../../../../mock/fauxrpc/stubs/errand-demand.yaml",
        import.meta.url,
      ),
      "utf8",
    );

    expect(errandDemandStub).toContain(
      "target: sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandList",
    );
    expect(errandDemandStub).toContain(
      "target: sast.sastshopv2.errand.v1.ErrandDemandService/GetDemandDetail",
    );
    expect(errandDemandStub).toContain('errandDemandItemId: "9101"');
    expect(errandDemandStub).toContain("serviceFeePerUnitCents: 50");
  });

  it("commits the configured fauxrpc mock user name", async () => {
    const userStub = await readFile(
      new URL("../../../../mock/fauxrpc/stubs/user.yaml", import.meta.url),
      "utf8",
    );

    expect(userStub).toContain("name: 阮小妍");
    expect(userStub).not.toContain("name: 南邮同学");
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
