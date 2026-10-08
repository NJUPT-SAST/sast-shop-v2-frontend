// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  withLarkPageJsapi,
  createProductTemplate,
  getProductTemplate,
  deleteProductTemplate,
  LarkClientError,
  listProductTemplatesPage,
  scanLarkBarcode,
  updateProductTemplate,
  type PageResult,
  type ProductTemplate,
} from "@sast-shop/api";
import { ProductTemplateManager } from "../components/product-template-manager";
import { uploadProductImage } from "./product-image-upload";
import { toast } from "sonner";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { TEMPLATE_STORE_STORAGE_KEY } from "./template-store-preference";
import { waitForDrawerHistoryCleanup } from "@workspace/ui/lib/drawer-history";
import { imageThumbnailSrc } from "@workspace/ui/lib/image-variants";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    onLoad,
    onError,
  }: {
    src: string | { src: string };
    alt: string;
    className?: string;
    onLoad?: React.ReactEventHandler<HTMLImageElement>;
    onError?: React.ReactEventHandler<HTMLImageElement>;
  }) =>
    React.createElement("img", {
      src: typeof src === "string" ? src : src.src,
      alt,
      className,
      onLoad,
      onError,
    }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));
vi.mock("@workspace/ui/lib/drawer-history", () => ({
  waitForDrawerHistoryCleanup: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  withLarkPageJsapi: vi.fn(),
  createProductTemplate: vi.fn(),
  getProductTemplate: vi.fn(),
  deleteProductTemplate: vi.fn(),
  listProductTemplatesPage: vi.fn(),
  scanLarkBarcode: vi.fn(),
  updateProductTemplate: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock("./product-image-upload", () => ({
  uploadProductImage: vi.fn(),
}));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: ({ children }: { children?: React.ReactNode }) => children,
}));
vi.mock("@workspace/ui/components/drawer", () => {
  const Content = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({
      open,
      children,
      onOpenChange,
    }: {
      open: boolean;
      children: React.ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) =>
      open ? (
        <div>
          <button onClick={() => onOpenChange?.(false)}>关闭模板弹层</button>
          {children}
        </div>
      ) : null,
    DrawerContent: Content,
    DrawerDescription: Content,
    DrawerFooter: Content,
    DrawerHeader: Content,
    DrawerTitle: Content,
  };
});

const template: ProductTemplate = {
  id: "4001",
  title: "矿泉水",
  description: "550ml",
  priceCents: 200,
  storeId: "3001",
  mainImageUrl: "",
  barcode: "690000000001",
  updatedAt: "2026-07-18T02:00:00Z",
};

let container: HTMLDivElement;
let root: Root;
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

beforeEach(() => {
  clearResourceCache();
  vi.mocked(waitForDrawerHistoryCleanup)
    .mockReset()
    .mockResolvedValue(undefined);
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.mocked(listProductTemplatesPage).mockReset();
  vi.mocked(getProductTemplate).mockReset().mockResolvedValue(template);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("h5sdk", undefined);
  vi.stubGlobal("tt", undefined);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
  );
  vi.mocked(withLarkPageJsapi).mockImplementation(
    async (_sdk, getConfig, operation) => {
      await getConfig(window.location.href.split("#", 1)[0] ?? "");
      return operation();
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      scrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

async function renderManager(
  items: ProductTemplate[],
  startCreating = false,
  requestedStoreId?: string,
  requestedTemplateId?: string,
  listState: { loading?: boolean; error?: string; onRetry?: () => void } = {},
) {
  await act(async () => {
    root.render(
      <ProductTemplateManager
        dataSource="mock"
        connectBaseUrl="http://localhost"
        stores={[
          {
            id: "3001",
            name: "SAST 小卖部",
            address: "南邮仙林校区",
            logoUrl: "",
            themeColor: "#0071e3",
          },
          {
            id: "3002",
            name: "二号店铺",
            address: "南邮三牌楼校区",
            logoUrl: "",
            themeColor: "#0071e3",
          },
        ]}
        initialPage={{
          items,
          currentPage: 1,
          pageSize: 10,
          totalCount: items.length,
          hasMore: false,
        }}
        selectedStoreId="3001"
        requestedStoreId={requestedStoreId}
        requestedTemplateId={requestedTemplateId}
        prefillBarcode="690000000001"
        startCreating={startCreating}
        error={listState.error ?? null}
        templatesLoading={listState.loading}
        onRetry={listState.onRetry}
      />,
    );
  });
}

async function click(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent?.trim() === text,
  );
  expect(button, `Missing button: ${text}`).toBeDefined();
  await act(async () => button!.click());
}

async function enterTemplateTitle(value: string) {
  const title = container.querySelector<HTMLInputElement>("#title")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(title, value);
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseProductImage() {
  const input = container.querySelector<HTMLInputElement>(
    "#product-template-image",
  )!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["image"], "product.png", { type: "image/png" })],
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

function submitTemplate() {
  container
    .querySelector<HTMLFormElement>("#product-template-form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

async function selectStore(selector: string, name: string) {
  const trigger = container.querySelector<HTMLElement>(selector)!;
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    );
  });
  const option = Array.from(
    document.querySelectorAll<HTMLElement>('[role="option"]'),
  ).find((element) => element.textContent === name);
  expect(option).toBeDefined();
  await act(async () => option!.click());
}

async function loadImageThumbnail(
  source: string,
  scope: ParentNode = container,
) {
  const thumbnail = Array.from(scope.querySelectorAll("img")).find(
    (image) => image.getAttribute("src") === imageThumbnailSrc(source),
  );
  expect(thumbnail).toBeDefined();
  await act(async () => thumbnail!.dispatchEvent(new Event("load")));
}

describe("product template drawer failures", () => {
  it("opens a requested template that is absent from the list using its full detail and actual store", async () => {
    const requested = {
      ...template,
      id: "4007",
      storeId: "3002",
      title: "直达模板",
      mainImageUrl: "https://example.test/direct-edit.png",
    };
    let finishDetail!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate).mockReturnValue(
      new Promise((resolve) => {
        finishDetail = resolve;
      }),
    );
    await renderManager([], false, "3001", "4007");
    expect(container.textContent).toContain("编辑商品模板");
    expect(
      container.querySelector('[aria-label="正在加载商品模板详情"]'),
    ).not.toBeNull();
    expect(container.querySelector("#title")).toBeNull();
    expect(getProductTemplate).toHaveBeenCalledWith(
      "4007",
      expect.objectContaining({ dataSource: "mock" }),
    );
    await act(async () => finishDetail(requested));
    expect(
      container.querySelector('[aria-label="正在加载商品模板详情"]'),
    ).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe(
      "直达模板",
    );
    expect(container.querySelector("#storeId")?.textContent).toContain(
      "二号店铺",
    );
    expect(
      container.querySelector<HTMLButtonElement>("#storeId")?.disabled,
    ).toBe(true);
    await loadImageThumbnail(requested.mainImageUrl);
    expect(
      container.querySelector('img[alt="商品图片预览"]')?.getAttribute("src"),
    ).toBe(requested.mainImageUrl);
  });

  it("keeps a failed direct edit local to its drawer and retries the requested template", async () => {
    vi.mocked(getProductTemplate)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...template, id: "4007" });
    await renderManager([template], false, "3001", "4007");
    expect(container.textContent).toContain("商品模板详情加载失败");
    expect(container.textContent).toContain("矿泉水");
    expect(container.querySelector("#product-template-form")).toBeNull();
    await click("重新加载");
    expect(getProductTemplate).toHaveBeenCalledTimes(2);
    expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe(
      "矿泉水",
    );
    expect(container.textContent).not.toContain("商品模板详情加载失败");
  });

  it("consumes a direct edit request once and does not reopen it after closing", async () => {
    vi.mocked(getProductTemplate).mockResolvedValue({
      ...template,
      id: "4007",
    });
    await renderManager([], false, "3001", "4007");
    await click("关闭模板弹层");
    await renderManager([], false, "3001", "4007");
    expect(getProductTemplate).toHaveBeenCalledOnce();
    expect(container.querySelector("#product-template-form")).toBeNull();
    expect(container.textContent).not.toContain("编辑商品模板");
  });

  it("ignores a requested template response after its drawer was closed", async () => {
    let finishDetail!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate).mockReturnValue(
      new Promise((resolve) => {
        finishDetail = resolve;
      }),
    );
    await renderManager([], false, "3001", "4007");
    await click("返回模板列表");
    await act(async () => finishDetail({ ...template, id: "4007" }));
    expect(container.querySelector("#product-template-form")).toBeNull();
    expect(container.textContent).not.toContain("编辑商品模板");
  });

  it("keeps the newest requested template when an older detail response arrives later", async () => {
    let finishOld!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce({ ...template, id: "4008", title: "新请求模板" });
    await renderManager([], false, "3001", "4007");
    await renderManager([], false, "3001", "4008");
    await act(async () =>
      finishOld({ ...template, id: "4007", title: "旧请求模板" }),
    );
    expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe(
      "新请求模板",
    );
  });

  it("cancels a requested edit when its URL request is removed", async () => {
    let finishDetail!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate).mockReturnValue(
      new Promise((resolve) => {
        finishDetail = resolve;
      }),
    );
    await renderManager([], false, "3001", "4007");
    await renderManager([], false, "3001");
    await act(async () => finishDetail({ ...template, id: "4007" }));
    expect(container.querySelector("#product-template-form")).toBeNull();
    expect(container.textContent).not.toContain("编辑商品模板");
  });

  it("ignores a requested detail response after the manager unmounts", async () => {
    let finishDetail!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate).mockReturnValue(
      new Promise((resolve) => {
        finishDetail = resolve;
      }),
    );
    await renderManager([], false, "3001", "4007");
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => finishDetail({ ...template, id: "4007" }));
    expect(container.querySelector("#product-template-form")).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("does not close a newer requested editor when an older template save completes", async () => {
    let finishSave!: (value: ProductTemplate) => void;
    vi.mocked(getProductTemplate)
      .mockResolvedValueOnce({ ...template, id: "4007" })
      .mockResolvedValueOnce({ ...template, id: "4008", title: "新请求模板" });
    vi.mocked(updateProductTemplate).mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    await renderManager([], false, "3001", "4007");
    await enterTemplateTitle("旧模板新名称");
    await act(async () => submitTemplate());
    await renderManager([], false, "3001", "4008");
    await act(async () =>
      finishSave({ ...template, id: "4007", title: "旧模板新名称" }),
    );
    expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe(
      "新请求模板",
    );
    expect(container.textContent).toContain("编辑商品模板");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("ignores an old editor image upload and keeps the new editor locked until its own upload finishes", async () => {
    let finishOldUpload!: (value: string) => void;
    let finishNewUpload!: (value: string) => void;
    vi.mocked(uploadProductImage)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOldUpload = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishNewUpload = resolve;
        }),
      );
    vi.mocked(getProductTemplate).mockResolvedValue({
      ...template,
      id: "4008",
    });
    await renderManager([], true);
    await chooseProductImage();
    await renderManager([], false, "3001", "4008");
    await chooseProductImage();
    await act(async () =>
      finishOldUpload("https://example.test/old-editor.png"),
    );
    expect(container.querySelector('img[alt="商品图片预览"]')).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[form="product-template-form"]',
      )?.disabled,
    ).toBe(true);
    await act(async () =>
      finishNewUpload("https://example.test/new-editor.png"),
    );
    await loadImageThumbnail("https://example.test/new-editor.png");
    expect(
      container.querySelector('img[alt="商品图片预览"]')?.getAttribute("src"),
    ).toBe("https://example.test/new-editor.png");
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[form="product-template-form"]',
      )?.disabled,
    ).toBe(false);
  });

  it("waits for the closing drawer history cleanup before navigating to a newly selected store", async () => {
    let finishCleanup!: () => void;
    vi.mocked(waitForDrawerHistoryCleanup).mockReturnValue(
      new Promise((resolve) => {
        finishCleanup = resolve;
      }),
    );
    vi.mocked(createProductTemplate).mockResolvedValue({
      ...template,
      storeId: "3002",
    });
    await renderManager([], true);
    await selectStore("#storeId", "二号店铺");
    await enterTemplateTitle("矿泉水");
    await act(async () => submitTemplate());
    expect(container.textContent).not.toContain("新建商品模板");
    expect(waitForDrawerHistoryCleanup).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => finishCleanup());
    expect(router.replace).toHaveBeenCalledWith("/group/templates?store=3002");
  });

  it("does not navigate after unmounting while drawer history cleanup is pending", async () => {
    let finishCleanup!: () => void;
    vi.mocked(waitForDrawerHistoryCleanup).mockReturnValue(
      new Promise((resolve) => {
        finishCleanup = resolve;
      }),
    );
    vi.mocked(createProductTemplate).mockResolvedValue({
      ...template,
      storeId: "3002",
    });
    await renderManager([], true);
    await selectStore("#storeId", "二号店铺");
    await enterTemplateTitle("矿泉水");
    await act(async () => submitTemplate());
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => finishCleanup());
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("remembers a store selected in the create drawer", async () => {
    await renderManager([], true);
    await selectStore("#storeId", "二号店铺");
    expect(container.querySelector("#storeId")?.textContent).toContain(
      "二号店铺",
    );
    expect(window.localStorage.getItem(TEMPLATE_STORE_STORAGE_KEY)).toBe(
      "3002",
    );
  });

  it("shows loading below the controls while keeping the create entry available", async () => {
    await renderManager([], false, undefined, undefined, { loading: true });
    const store = container.querySelector("#template-store")!;
    const search = container.querySelector("#template-search")!;
    const loading = container.querySelector('[role="status"]')!;
    expect(
      search.compareDocumentPosition(loading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.textContent).not.toContain("暂无商品模板");
    expect(document.querySelector('[aria-label="新建模板"]')).not.toBeNull();
    await renderManager([template]);
    expect(container.querySelector("#template-store")).toBe(store);
    expect(container.querySelector("#template-search")).toBe(search);
    expect(container.textContent).toContain("矿泉水");
  });

  it("retries a failed template list without navigating or hiding the controls", async () => {
    const onRetry = vi.fn();
    await renderManager([], false, undefined, undefined, {
      error: "模板请求失败",
      onRetry,
    });
    expect(container.querySelector("#template-store")).not.toBeNull();
    expect(container.querySelector("#template-search")).not.toBeNull();
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("重新加载"),
    )!;
    await act(async () => retry.click());
    expect(onRetry).toHaveBeenCalledOnce();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("remembers a store selected in the list before navigating to it", async () => {
    await renderManager([]);
    await selectStore("#template-store", "二号店铺");
    expect(window.localStorage.getItem(TEMPLATE_STORE_STORAGE_KEY)).toBe(
      "3002",
    );
    expect(router.replace).toHaveBeenCalledWith("/group/templates?store=3002");
  });

  it("restores the last store when creating and returns to its list after saving", async () => {
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    vi.mocked(createProductTemplate).mockResolvedValue({
      ...template,
      storeId: "3002",
    });
    await renderManager([]);
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="新建模板"]')!
        .click(),
    );
    expect(container.querySelector("#storeId")?.textContent).toContain(
      "二号店铺",
    );
    await enterTemplateTitle("矿泉水");
    await act(async () => submitTemplate());

    expect(createProductTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "3002" }),
      expect.anything(),
    );
    expect(window.localStorage.getItem(TEMPLATE_STORE_STORAGE_KEY)).toBe(
      "3002",
    );
    expect(router.replace).toHaveBeenCalledWith("/group/templates?store=3002");
  });

  it("lets the explicit store override the remembered create selection without replacing the preference on mount", async () => {
    window.localStorage.setItem(TEMPLATE_STORE_STORAGE_KEY, "3002");
    await renderManager([], false, "3001");
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="新建模板"]')!
        .click(),
    );
    expect(container.querySelector("#storeId")?.textContent).toContain(
      "SAST 小卖部",
    );
    expect(window.localStorage.getItem(TEMPLATE_STORE_STORAGE_KEY)).toBe(
      "3002",
    );
  });

  it("renders the list image before opening the editor and uses a fallback after failure", async () => {
    const imageUrl = "https://example.test/template-list-image.png";
    await renderManager([{ ...template, mainImageUrl: imageUrl }]);

    const item = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("矿泉水"),
    )!;
    const thumbnail = item.querySelector("img")!;
    expect(thumbnail).not.toBeNull();
    expect(thumbnail.getAttribute("src")).toBe(imageThumbnailSrc(imageUrl));
    expect(thumbnail.getAttribute("alt")).toBe("");
    expect(container.textContent).not.toContain("编辑商品模板");

    await loadImageThumbnail(imageUrl, item);
    const display = item.querySelector('img[alt="矿泉水"]')!;
    expect(display).not.toBeNull();
    expect(display.getAttribute("src")).toBe(imageUrl);
    await act(async () => display.dispatchEvent(new Event("error")));
    expect(item.querySelector('img[alt="矿泉水"]')).toBeNull();
    expect(item.querySelector("img")).toBe(thumbnail);
    expect(thumbnail.classList.contains("opacity-0")).toBe(false);
    expect(item.querySelector('[data-slot="skeleton"]')).toBeNull();

    await act(async () => item.click());
    expect(container.textContent).toContain("编辑商品模板");
    expect(
      container.querySelector('img[alt="商品图片预览"]')?.getAttribute("src"),
    ).toBe(imageUrl);
  });

  it("associates validation errors with their fields and clears the association after correction", async () => {
    await renderManager([], true);
    await act(async () => submitTemplate());

    const title = container.querySelector<HTMLInputElement>("#title")!;
    expect(title.getAttribute("aria-invalid")).toBe("true");
    const errorId = title.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe(
      "请输入商品名称",
    );
    expect(container.querySelectorAll(`[id="${errorId}"]`)).toHaveLength(1);
    expect(createProductTemplate).not.toHaveBeenCalled();

    await enterTemplateTitle("矿泉水");
    expect(title.getAttribute("aria-invalid")).toBe("false");
    expect(title.hasAttribute("aria-describedby")).toBe(false);
    expect(document.getElementById(errorId)).toBeNull();
  });

  it("searches the selected store on the server and loads only its matching next page", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let enterViewport!: (entries: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof enterViewport) {
          enterViewport = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const match = { ...template, id: "4002", title: "苹果" };
    vi.mocked(listProductTemplatesPage).mockResolvedValueOnce({
      items: [match],
      currentPage: 1,
      pageSize: 10,
      totalCount: 11,
      hasMore: true,
    });
    vi.mocked(listProductTemplatesPage).mockResolvedValueOnce({
      items: [{ ...match, id: "4003", title: "苹果汁" }],
      currentPage: 2,
      pageSize: 10,
      totalCount: 11,
      hasMore: false,
    });
    await renderManager([template]);
    const input =
      container.querySelector<HTMLInputElement>("#template-search")!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(input, "苹果");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("矿泉水");
    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(1);
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "苹果", storeId: "3001", page: 1 }),
    );
    expect(container.textContent).toContain("苹果");
    expect(container.textContent).not.toContain("矿泉水");
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(1);
    await act(async () => enterViewport([{ isIntersecting: true }]));
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "苹果", storeId: "3001", page: 2 }),
    );
    expect(container.textContent).toContain("苹果汁");
    await act(async () => {
      setValue.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(container.textContent).toContain("矿泉水");
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(2);
  });

  it("keeps the current search when an older keyword request resolves later", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let resolveOld!: (page: PageResult<ProductTemplate>) => void;
    vi.mocked(listProductTemplatesPage).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const result = {
      items: [{ ...template, title: "苹果" }],
      currentPage: 1,
      pageSize: 10,
      totalCount: 1,
      hasMore: false,
    };
    vi.mocked(listProductTemplatesPage).mockResolvedValueOnce(result);
    await renderManager([template]);
    const input =
      container.querySelector<HTMLInputElement>("#template-search")!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    for (const keyword of ["矿泉水", "苹果"]) {
      await act(async () => {
        setValue.call(input, keyword);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => vi.advanceTimersByTimeAsync(250));
    }
    expect(container.textContent).toContain("苹果");
    await act(async () => resolveOld({ ...result, items: [template] }));
    expect(container.textContent).toContain("苹果");
    expect(container.textContent).not.toContain("矿泉水");
  });

  it("revalidates search results when an edited template no longer matches", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const matchedTemplate = { ...template, title: "苹果" };
    vi.mocked(listProductTemplatesPage).mockResolvedValueOnce({
      items: [matchedTemplate],
      currentPage: 1,
      pageSize: 10,
      totalCount: 1,
      hasMore: false,
    });
    vi.mocked(listProductTemplatesPage).mockResolvedValueOnce({
      items: [],
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      hasMore: false,
    });
    vi.mocked(updateProductTemplate).mockResolvedValueOnce({
      ...matchedTemplate,
      title: "梨",
    });
    await renderManager([template]);
    const input =
      container.querySelector<HTMLInputElement>("#template-search")!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(input, "苹果");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    const item = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("苹果"),
    )!;
    await act(async () => item.click());
    await enterTemplateTitle("梨");
    await act(async () => submitTemplate());
    expect(updateProductTemplate).toHaveBeenCalledTimes(1);
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(2);
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "苹果", page: 1, storeId: "3001" }),
    );
    expect(container.textContent).toContain("没有匹配的商品模板");
    expect(container.textContent).not.toContain("梨");
  });
  it("shows a save error in the drawer and keeps the entered title", async () => {
    vi.mocked(createProductTemplate).mockRejectedValue(
      new Error("服务暂不可用"),
    );
    await renderManager([], true);

    await enterTemplateTitle("矿泉水");
    await act(async () => submitTemplate());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "保存商品模板失败，请稍后再试",
    );
    expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe(
      "矿泉水",
    );
    expect(container.textContent).toContain("新建商品模板");
  });

  it("keeps deletion confirmation open with an inline error", async () => {
    vi.mocked(deleteProductTemplate).mockRejectedValue(new Error("删除被拒绝"));
    await renderManager([template]);

    const item = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("矿泉水"),
    );
    expect(item).toBeDefined();
    await act(async () => item!.click());
    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="删除商品模板"]',
    )!;
    await act(async () => deleteButton.click());
    await click("删除");

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "删除被拒绝",
    );
    expect(container.textContent).toContain("删除商品模板？");
    expect(container.textContent).toContain("编辑商品模板");
  });

  it("sends only one create request when the form is submitted twice immediately", async () => {
    let resolveCreate!: (value: ProductTemplate) => void;
    vi.mocked(createProductTemplate).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    await renderManager([], true);
    await enterTemplateTitle("矿泉水");

    await act(async () => {
      submitTemplate();
      submitTemplate();
    });
    expect(createProductTemplate).toHaveBeenCalledTimes(1);

    await act(async () => resolveCreate(template));
  });

  it("waits for image upload before allowing the template to be saved", async () => {
    let resolveUpload!: (value: string) => void;
    vi.mocked(uploadProductImage).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    vi.mocked(createProductTemplate).mockResolvedValue(template);
    await renderManager([], true);
    await enterTemplateTitle("矿泉水");

    const fileInput = container.querySelector<HTMLInputElement>(
      "#product-template-image",
    )!;
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [new File(["image"], "product.png", { type: "image/png" })],
    });
    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const saveButton = container.querySelector<HTMLButtonElement>(
      'button[form="product-template-form"]',
    )!;
    expect(saveButton.disabled).toBe(true);
    expect(saveButton.textContent).toContain("图片上传中");
    await act(async () => submitTemplate());
    expect(createProductTemplate).not.toHaveBeenCalled();

    await act(async () => resolveUpload("https://example.test/product.png"));
    expect(saveButton.disabled).toBe(false);
    await act(async () => submitTemplate());
    expect(createProductTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        mainImageUrl: "https://example.test/product.png",
      }),
      expect.anything(),
    );
  });
});

describe("product template barcode scan", () => {
  function enterFeishu() {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn(), config: vi.fn() });
    vi.stubGlobal("tt", { scanCode: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              appId: "cli_test",
              timestamp: "1234567890",
              nonceStr: "test-nonce",
              signature: "test-signature",
            }),
            { status: 200 },
          ),
      ),
    );
  }

  function scanButton() {
    return container.querySelector<HTMLButtonElement>(
      '[aria-label="扫码填写商品条码"]',
    )!;
  }

  it("shows the icon with the real environment hook and fills scanned barcode", async () => {
    enterFeishu();
    vi.mocked(scanLarkBarcode).mockResolvedValue("0690000000001");
    await renderManager([], true);
    expect(scanButton()).not.toBeNull();
    expect(scanButton().getAttribute("type")).toBe("button");
    await act(async () => scanButton().click());
    expect(withLarkPageJsapi).toHaveBeenCalledWith(
      window.h5sdk,
      expect.any(Function),
      expect.any(Function),
    );
    expect(scanLarkBarcode).toHaveBeenCalledWith(window.tt);
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "0690000000001",
    );
    expect(createProductTemplate).not.toHaveBeenCalled();
  });

  it("allows retry after cancellation without changing the barcode", async () => {
    enterFeishu();
    vi.mocked(scanLarkBarcode).mockRejectedValueOnce(
      new LarkClientError("用户取消扫码", 1505002),
    );
    await renderManager([], true);
    await act(async () => scanButton().click());
    expect(toast.error).not.toHaveBeenCalled();
    expect(scanButton().disabled).toBe(false);
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
    vi.mocked(scanLarkBarcode).mockResolvedValueOnce("690000000002");
    await act(async () => scanButton().click());
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000002",
    );
  });

  it("keeps manual entry when SDK loading or signing fails", async () => {
    enterFeishu();
    vi.stubGlobal("h5sdk", undefined);
    await renderManager([], true);
    await act(async () => scanButton().click());
    expect(toast.message).toHaveBeenCalledWith(
      "飞书扫码组件尚未就绪，请稍后重试或手动输入",
    );
    expect(scanLarkBarcode).not.toHaveBeenCalled();
    vi.stubGlobal("h5sdk", { ready: vi.fn(), config: vi.fn() });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await act(async () => scanButton().click());
    expect(toast.error).toHaveBeenCalledWith("登录已失效，请重新打开应用");
    expect(scanButton().disabled).toBe(false);
    expect(
      container.querySelector<HTMLInputElement>("#barcode")?.disabled,
    ).toBe(false);
  });

  it("prevents duplicate scans and saving while the scanner is active", async () => {
    enterFeishu();
    let resolveScan!: (barcode: string) => void;
    vi.mocked(scanLarkBarcode).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveScan = resolve;
      }),
    );
    await renderManager([], true);
    await enterTemplateTitle("矿泉水");
    await act(async () => {
      scanButton().click();
      scanButton().click();
      submitTemplate();
    });
    expect(scanLarkBarcode).toHaveBeenCalledTimes(1);
    expect(createProductTemplate).not.toHaveBeenCalled();
    expect(scanButton().disabled).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>("#barcode")?.disabled,
    ).toBe(true);
    await act(async () => resolveScan("690000000003"));
    expect(scanButton().disabled).toBe(false);
  });

  it("hides the scan button outside the Feishu mobile client", async () => {
    await renderManager([], true);
    expect(scanButton()).toBeNull();
  });

  it("does not fill a newly requested template with an old editor's scan result", async () => {
    enterFeishu();
    let finishScan!: (value: string) => void;
    vi.mocked(scanLarkBarcode).mockReturnValue(
      new Promise((resolve) => {
        finishScan = resolve;
      }),
    );
    vi.mocked(getProductTemplate).mockResolvedValue({
      ...template,
      id: "4008",
      barcode: "690000000008",
    });
    await renderManager([], true);
    await act(async () => scanButton().click());
    await renderManager([], false, "3001", "4008");
    await act(async () => finishScan("690000000001"));
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000008",
    );
  });
});
