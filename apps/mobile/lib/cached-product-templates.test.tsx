// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProductTemplatesPage, listStores } from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { CachedProductTemplates } from "../components/cached-product-templates";
import { TEMPLATE_STORE_STORAGE_KEY } from "./template-store-preference";

vi.mock("@sast-shop/api", () => ({
  listStores: vi.fn(),
  listProductTemplatesPage: vi.fn(),
}));
vi.mock("../components/product-template-manager", () => ({
  ProductTemplateManager: ({
    selectedStoreId,
    requestedTemplateId,
  }: {
    selectedStoreId: string;
    requestedTemplateId?: string;
  }) => (
    <div data-selected-store data-requested-template={requestedTemplateId}>
      {selectedStoreId}
    </div>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  clearResourceCache();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.mocked(listStores).mockResolvedValue([
    {
      id: "3001",
      name: "一号店铺",
      address: "校内",
      logoUrl: "",
      themeColor: "",
    },
    {
      id: "3002",
      name: "二号店铺",
      address: "校内",
      logoUrl: "",
      themeColor: "",
    },
  ]);
  vi.mocked(listProductTemplatesPage).mockResolvedValue({
    items: [],
    currentPage: 1,
    pageSize: 20,
    totalCount: 0,
    hasMore: false,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function render(requestedStoreId?: string, requestedTemplateId?: string) {
  await act(async () =>
    root.render(
      <CachedProductTemplates
        dataSource="mock"
        connectBaseUrl="http://localhost"
        refreshKey="visit"
        requestedStoreId={requestedStoreId}
        requestedTemplateId={requestedTemplateId}
        prefillBarcode=""
        startCreating={false}
      />,
    ),
  );
}

describe("cached template store selection", () => {
  it("passes a requested template to the editor without changing the cached list query", async () => {
    await render("3001", "4007");
    expect(
      container
        .querySelector("[data-selected-store]")
        ?.getAttribute("data-requested-template"),
    ).toBe("4007");
    await render("3001", "4008");
    expect(
      container
        .querySelector("[data-selected-store]")
        ?.getAttribute("data-requested-template"),
    ).toBe("4008");
    expect(listProductTemplatesPage).toHaveBeenCalledOnce();
  });

  it("keeps the current list stable while a create drawer changes the next default", async () => {
    await render();
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    await render();
    expect(container.querySelector("[data-selected-store]")?.textContent).toBe(
      "3001",
    );
    expect(listProductTemplatesPage).toHaveBeenCalledOnce();
  });

  it("loads the remembered store for the list and create defaults", async () => {
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    await render();
    expect(listProductTemplatesPage).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "3002" }),
    );
    expect(container.querySelector("[data-selected-store]")?.textContent).toBe(
      "3002",
    );
  });

  it("loads the explicit store before the remembered store without overwriting memory", async () => {
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    await render("3001");
    expect(listProductTemplatesPage).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "3001" }),
    );
    expect(container.querySelector("[data-selected-store]")?.textContent).toBe(
      "3001",
    );
    expect(window.localStorage.getItem(TEMPLATE_STORE_STORAGE_KEY)).toBe(
      "3002",
    );
  });

  it("falls back to the first store when the remembered store is unavailable", async () => {
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "9999");
    await render();
    expect(container.querySelector("[data-selected-store]")?.textContent).toBe(
      "3001",
    );
  });

  it("does not reuse a different store's cached list after the remembered selection changes", async () => {
    await render();
    expect(container.querySelector("[data-selected-store]")?.textContent).toBe(
      "3001",
    );
    await act(async () => root.unmount());
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    root = createRoot(container);
    await render();
    expect(container.querySelector("[data-selected-store]")?.textContent).toBe(
      "3002",
    );
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeId: "3002" }),
    );
  });
});
