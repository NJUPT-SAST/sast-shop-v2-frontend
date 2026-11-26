import { afterEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "../errors";
import {
  createProductCategory,
  deleteProductCategory,
  listProductCategories,
} from "./product-categories";

const localOptions = {
  dataSource: "local" as const,
  connectBaseUrl: "http://localhost",
};

describe("product category services", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the category tree and uncategorized state for one store", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        categories: [
          { id: "11", storeId: "3", name: "饮料", sortOrder: 0 },
          {
            id: "12",
            storeId: "3",
            parentId: "11",
            name: "矿泉水",
            sortOrder: 0,
          },
        ],
        hasUncategorizedProducts: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProductCategories("3", localOptions)).resolves.toEqual({
      categories: [
        { id: "11", storeId: "3", parentId: null, name: "饮料", sortOrder: 0 },
        {
          id: "12",
          storeId: "3",
          parentId: "11",
          name: "矿泉水",
          sortOrder: 0,
        },
      ],
      hasUncategorizedProducts: true,
    });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/ListProductCategories",
      body: { storeId: "3" },
    });
  });

  it("creates root and child categories with the supplied parent", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        category: {
          id: "12",
          storeId: "3",
          parentId: "11",
          name: "矿泉水",
          sortOrder: 0,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createProductCategory(
        { storeId: "3", parentId: "11", name: " 矿泉水 " },
        localOptions,
      ),
    ).resolves.toEqual({
      id: "12",
      storeId: "3",
      parentId: "11",
      name: "矿泉水",
      sortOrder: 0,
    });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/CreateProductCategory",
      body: { storeId: "3", parentId: "11", name: "矿泉水" },
    });
  });

  it("deletes by both store and category identifiers", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await deleteProductCategory(
      { storeId: "3", categoryId: "12" },
      localOptions,
    );

    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.catalog.v1.ProductTemplateService/DeleteProductCategory",
      body: { storeId: "3", categoryId: "12" },
    });
  });

  it("rejects malformed category input before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listProductCategories("0", localOptions),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createProductCategory(
        { storeId: "3", parentId: "0", name: "饮料" },
        localOptions,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
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
  const text =
    body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body);
  expect(JSON.parse(text)).toEqual(expected.body);
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
