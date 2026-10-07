// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProductTemplate,
  getProductTemplate,
  updateProductTemplate,
  type ProductTemplate,
} from "@sast-shop/api";
import { ProductTemplateManager } from "../components/product-template-manager";
import { uploadProductImage } from "./product-image-upload";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { TEMPLATE_STORE_STORAGE_KEY } from "./template-store-preference";

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
async function render(
  edit?: string,
  items: ProductTemplate[] = [],
  strict = false,
) {
  const manager = (
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
    />
  );
  await act(async () =>
    root.render(
      strict ? <React.StrictMode>{manager}</React.StrictMode> : manager,
    ),
  );
}
function button(name: string) {
  const found = Array.from(document.body.querySelectorAll("button")).find(
    (item) =>
      item.getAttribute("aria-label") === name ||
      item.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
function input(id: string) {
  return document.body.querySelector<HTMLInputElement>(`#${id}`)!;
}
async function fill(id: string, value: string) {
  await act(async () => {
    const element = input(id);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("desktop template editing", () => {
  it("loads a deep link through React StrictMode effect replay", async () => {
    await render("4001", [], true);
    expect(input("template-form-title").value).toBe(template.title);
    expect(getProductTemplate).toHaveBeenCalledOnce();
  });
  it("loads a requested template outside the first page and keeps its store locked", async () => {
    vi.mocked(getProductTemplate).mockResolvedValue({
      ...template,
      storeId: "3002",
    });
    await render("4001");
    expect(getProductTemplate).toHaveBeenCalledWith("4001", {
      dataSource: "mock",
      connectBaseUrl: "http://localhost",
    });
    expect(input("template-form-title").value).toBe("最新矿泉水");
    expect(
      document.body
        .querySelector("#template-form-store")
        ?.hasAttribute("disabled"),
    ).toBe(true);
    expect(document.body.textContent).toContain(
      "编辑时不能更换店铺；请在目标店铺新建模板",
    );
    expect(document.body.textContent).toContain("二号店");
  });
  it("fetches latest details for a list card before editing and writes that precise version", async () => {
    await render(undefined, [
      { ...template, title: "旧标题", updatedAt: "2026-07-18T02:00:00Z" },
    ]);
    await click("编辑旧标题");
    await fill("template-form-title", "更新标题");
    await click("保存");
    expect(updateProductTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "4001",
        updatedAt: template.updatedAt,
        patch: expect.objectContaining({ title: "更新标题" }),
      }),
      expect.anything(),
    );
    expect(
      vi.mocked(updateProductTemplate).mock.calls[0]![0].patch,
    ).not.toHaveProperty("storeId");
  });
  it("shows skeleton then a local retry when detail fails", async () => {
    const loading = deferred<ProductTemplate>();
    vi.mocked(getProductTemplate).mockReturnValueOnce(loading.promise);
    await render("4001");
    expect(
      document.body.querySelector('[aria-label="正在加载商品模板详情"]'),
    ).not.toBeNull();
    expect(button("保存").disabled).toBe(true);
    await act(async () => loading.reject(new Error("network")));
    expect(document.body.textContent).toContain("商品模板加载失败");
    await click("重新加载");
    expect(input("template-form-title").value).toBe(template.title);
  });
  it("does not let a late detail response reopen a closed dialog", async () => {
    const loading = deferred<ProductTemplate>();
    vi.mocked(getProductTemplate).mockReturnValueOnce(loading.promise);
    await render("4001");
    await click("关闭");
    await act(async () => loading.resolve(template));
    expect(document.body.querySelector("#desktop-template-form")).toBeNull();
    await render("4001");
    expect(getProductTemplate).toHaveBeenCalledOnce();
  });
  it("ignores the previous template when the edit query changes", async () => {
    const old = deferred<ProductTemplate>();
    vi.mocked(getProductTemplate).mockReturnValueOnce(old.promise);
    await render("4001");
    vi.mocked(getProductTemplate).mockResolvedValue({
      ...template,
      id: "4002",
      title: "新模板",
    });
    await render("4002");
    await act(async () => old.resolve(template));
    expect(input("template-form-title").value).toBe("新模板");
  });
  it("ignores an uploaded image after unmount", async () => {
    const upload = deferred<string>();
    vi.mocked(uploadProductImage).mockReturnValueOnce(upload.promise);
    await render("4001");
    const element =
      document.body.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      Object.defineProperty(element, "files", {
        value: [new File(["image"], "image.png", { type: "image/png" })],
      });
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => upload.resolve("https://example.com/upload.jpg"));
    expect(container.innerHTML).toBe("");
  });
  it("uses remembered store on new template and navigates without mixing stores into current list", async () => {
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    vi.mocked(createProductTemplate).mockResolvedValue({
      ...template,
      storeId: "3002",
    });
    await render();
    await click("新建模板");
    expect(
      document.body.querySelector("#template-form-store")?.textContent,
    ).toContain("二号店");
    await fill("template-form-barcode", template.barcode);
    await fill("template-form-title", "矿泉水");
    await click("保存");
    expect(createProductTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "3002" }),
      expect.anything(),
    );
    expect(router.replace).toHaveBeenCalledWith("/group/templates?store=3002");
    expect(document.body.textContent).not.toContain("最新矿泉水");
  });
  it("blocks duplicate saves synchronously and keeps the dialog while writing", async () => {
    const save = deferred<ProductTemplate>();
    vi.mocked(updateProductTemplate).mockReturnValueOnce(save.promise);
    await render("4001");
    await act(async () => {
      button("保存").click();
      button("保存").click();
    });
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(
      document.body.querySelector("#desktop-template-form"),
    ).not.toBeNull();
    expect(updateProductTemplate).toHaveBeenCalledOnce();
    await act(async () => save.resolve(template));
    expect(document.body.querySelector("#desktop-template-form")).toBeNull();
  });
});
