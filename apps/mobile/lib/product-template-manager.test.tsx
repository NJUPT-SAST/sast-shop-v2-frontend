// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureLarkJsapi,
  createProductTemplate,
  deleteProductTemplate,
  LarkClientError,
  scanLarkBarcode,
  type PageResult,
  type ProductTemplate,
} from "@sast-shop/api";
import { ProductTemplateManager } from "../components/product-template-manager";
import { uploadProductImage } from "./product-image-upload";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  configureLarkJsapi: vi.fn(),
  createProductTemplate: vi.fn(),
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
vi.mock("@workspace/ui/hooks/use-infinite-page", () => ({
  useInfinitePage: ({
    initialPage,
  }: {
    initialPage: PageResult<ProductTemplate>;
  }) => ({
    items: initialPage.items,
    setItems: vi.fn(),
    loadingMore: false,
    loadMoreError: null,
    hasMore: false,
    totalCount: initialPage.totalCount,
    loadMore: vi.fn(),
  }),
}));
vi.mock("@workspace/ui/components/drawer", () => {
  const Content = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div>{children}</div> : null),
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

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("h5sdk", undefined);
  vi.stubGlobal("tt", undefined);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
  );
  vi.mocked(configureLarkJsapi).mockResolvedValue(undefined);
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
});

async function renderManager(items: ProductTemplate[], startCreating = false) {
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
        ]}
        initialPage={{
          items,
          currentPage: 1,
          pageSize: 10,
          totalCount: items.length,
          hasMore: false,
        }}
        selectedStoreId="3001"
        prefillBarcode="690000000001"
        startCreating={startCreating}
        error={null}
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

function submitTemplate() {
  container
    .querySelector<HTMLFormElement>("#product-template-form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("product template drawer failures", () => {
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
    expect(configureLarkJsapi).toHaveBeenCalledWith(
      window.h5sdk,
      expect.objectContaining({ appId: "cli_test" }),
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
});
