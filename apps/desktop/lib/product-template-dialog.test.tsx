// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProductTemplate,
  updateProductTemplate,
  type ProductTemplate,
} from "@sast-shop/api";
import { ProductTemplateManager } from "../components/product-template-manager";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@sast-shop/api", async (original) => ({
  ...(await original<typeof import("@sast-shop/api")>()),
  createProductTemplate: vi.fn(),
  getProductTemplate: vi.fn(),
  updateProductTemplate: vi.fn(),
}));
vi.mock("./product-image-upload", () => ({ uploadProductImage: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: ({ children }: { children: React.ReactNode }) => children,
}));
const template: ProductTemplate = {
  id: "4001",
  storeId: "3001",
  title: "最新矿泉水",
  description: "550ml",
  barcode: "690000000001",
  mainImageUrl: "https://example.com/water.jpg",
  priceCents: 200,
  updatedAt: "2026-07-18T03:00:00.123456789Z",
};
const stores = [
  { id: "3001", name: "一号店", address: "校内", logoUrl: "", themeColor: "" },
  { id: "3002", name: "二号店", address: "校内", logoUrl: "", themeColor: "" },
];
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
  vi.mocked(getProductTemplate).mockResolvedValue(template);
  vi.mocked(updateProductTemplate).mockResolvedValue(template);
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
async function render(edit?: string, items: ProductTemplate[] = []) {
  await act(async () =>
    root.render(
      <ProductTemplateManager
        dataSource="mock"
        connectBaseUrl="http://localhost"
        stores={stores}
        initialPage={{
          items,
          currentPage: 1,
          pageSize: 24,
          totalCount: items.length,
          hasMore: false,
        }}
        selectedStoreId="3001"
        requestedTemplateId={edit}
        prefillBarcode=""
        startCreating={false}
        error={null}
      />,
    ),
  );
}
function button(name: string) {
  const found = Array.from(container.querySelectorAll("button")).find(
    (item) =>
      item.getAttribute("aria-label") === name ||
      item.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
describe("desktop template Dialog keyboard behavior", () => {
  it("focuses the barcode when delayed details load and restores the explicit opener", async () => {
    let resolve!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate).mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes;
      }),
    );
    await render(undefined, [template]);
    const opener = button("编辑最新矿泉水");
    await act(async () => opener.click());
    expect(
      document.querySelector('[aria-label="正在加载商品模板详情"]'),
    ).not.toBeNull();
    await act(async () => resolve(template));
    expect(document.activeElement).toBe(
      document.querySelector("#template-form-barcode"),
    );
    await act(async () =>
      document
        .querySelector("#template-form-barcode")!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    await act(async () => new Promise((yes) => setTimeout(yes, 0)));
    expect(document.activeElement).toBe(opener);
  });
  it("focuses a loaded deep link and returns to the fallback create entry", async () => {
    await render("4001");
    expect(document.activeElement).toBe(
      document.querySelector("#template-form-barcode"),
    );
    const opener = button("新建模板");
    await act(async () =>
      document
        .querySelector("#template-form-barcode")!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
    );
    await act(async () => new Promise((yes) => setTimeout(yes, 0)));
    expect(document.activeElement).toBe(opener);
  });
  it("restores keyboard focus to the visible edit entry when Escape closes", async () => {
    await render(undefined, [template]);
    const opener = button("编辑最新矿泉水");
    await act(async () => {
      opener.focus();
      opener.click();
    });
    const title = document.querySelector<HTMLInputElement>(
      "#template-form-title",
    )!;
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      title.focus();
      title.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it("handles native form submission and restores focus after saving", async () => {
    await render(undefined, [template]);
    const opener = button("编辑最新矿泉水");
    await act(async () => {
      opener.focus();
      opener.click();
    });
    await act(async () =>
      document
        .querySelector("#desktop-template-form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(updateProductTemplate).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
