// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSpotGoods,
  getProductTemplatesByBarcode,
  listPaymentQrCodes,
  scanLarkBarcode,
} from "@sast-shop/api";
import { PublishSpotForm } from "../components/publish-spot-form";

const { ensureAgreement } = vi.hoisted(() => ({ ensureAgreement: vi.fn() }));

vi.mock("@sast-shop/api", () => ({
  withLarkPageJsapi: vi.fn(async (_sdk, _getConfig, operation) => operation()),
  createSpotGoods: vi.fn(),
  getProductTemplatesByBarcode: vi.fn(),
  isLarkScanCancelledError: (reason: unknown) =>
    reason instanceof Error && reason.message === "cancelled",
  listPaymentQrCodes: vi.fn(),
  scanLarkBarcode: vi.fn(),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("../hooks/use-feishu-ui-environment", () => ({
  useFeishuUiEnvironment: () => true,
}));
vi.mock("../lib/jsapi-config", () => ({ isJsapiAuthConfig: () => true }));
vi.mock("../components/profile-dialogs-provider", () => ({
  useProfileDialogs: () => ({ openQrCodeDialog: vi.fn() }),
}));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: () => null,
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

const match = {
  productTemplate: {
    id: "4001",
    title: "矿泉水",
    description: "瓶装水",
    priceCents: 200,
    storeId: "3001",
    mainImageUrl: "",
    barcode: "690000000001",
    updatedAt: "2026-07-18T02:00:00Z",
  },
  store: {
    id: "3001",
    name: "SAST 小卖部",
    address: "南邮仙林校区",
    logoUrl: "",
    themeColor: "#0071e3",
  },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("h5sdk", {});
  vi.stubGlobal("tt", {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
  vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([]);
  vi.mocked(listPaymentQrCodes).mockResolvedValue([]);
  vi.mocked(scanLarkBarcode).mockReset();
  ensureAgreement.mockReset().mockResolvedValue(true);
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

async function renderForm(entry: "manual" | "scan", initialBarcode = "") {
  await act(async () => {
    root.render(
      <PublishSpotForm
        dataSource="mock"
        connectBaseUrl="http://localhost"
        entry={entry}
        initialBarcode={initialBarcode}
      />,
    );
  });
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent === label,
  );
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

async function enterBarcode(value: string) {
  const input = container.querySelector<HTMLInputElement>("#barcode");
  expect(input).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("publish spot scan recovery", () => {
  it("looks up a barcode passed from the entry drawer", async () => {
    vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([match]);
    await renderForm("manual", "690000000001");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
    expect(getProductTemplatesByBarcode).toHaveBeenCalledWith(
      "690000000001",
      expect.objectContaining({ dataSource: "mock" }),
    );
    expect(container.textContent).toContain("矿泉水");
  });

  it("keeps manual entry hidden until the Feishu SDK is ready and scanning succeeds", async () => {
    vi.stubGlobal("h5sdk", undefined);
    vi.stubGlobal("tt", undefined);
    await renderForm("scan");

    expect(container.querySelector("#barcode")).toBeNull();
    expect(container.textContent).not.toContain("手动输入");
    expect(scanLarkBarcode).not.toHaveBeenCalled();
    vi.stubGlobal("h5sdk", {});
    vi.stubGlobal("tt", {});
    vi.mocked(scanLarkBarcode).mockResolvedValueOnce("690000000001");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => ["开始扫码", "再次扫码"].includes(button.textContent ?? ""),
    );
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(scanLarkBarcode).toHaveBeenCalledOnce();
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
  });

  it("uses an already scanned barcode without opening the scanner again", async () => {
    vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([match]);
    await renderForm("scan", "690000000001");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });
    expect(scanLarkBarcode).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
    expect(getProductTemplatesByBarcode).toHaveBeenCalledWith(
      "690000000001",
      expect.objectContaining({ dataSource: "mock" }),
    );
    expect(container.textContent).toContain("矿泉水");
  });

  it("keeps manual entry hidden after cancellation and allows scanning again", async () => {
    vi.mocked(scanLarkBarcode).mockRejectedValueOnce(new Error("cancelled"));
    await renderForm("scan");

    expect(container.textContent).toContain("已取消扫码，可以重试");
    expect(container.querySelector("#barcode")).toBeNull();
    expect(container.textContent).not.toContain("手动输入");
    vi.mocked(scanLarkBarcode).mockResolvedValueOnce("690000000001");
    await click("再次扫码");
    expect(scanLarkBarcode).toHaveBeenCalledTimes(2);
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
  });

  it("retries after an SDK failure", async () => {
    vi.mocked(scanLarkBarcode).mockRejectedValueOnce(
      new Error("扫码设备不可用"),
    );
    await renderForm("scan");

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "扫码设备不可用",
    );
    vi.mocked(scanLarkBarcode).mockResolvedValue("690000000001");
    await click("再次扫码");

    expect(scanLarkBarcode).toHaveBeenCalledTimes(2);
    expect(container.querySelector("#barcode")).not.toBeNull();
  });

  it("warns about QR setup before publishing and still checks on submit", async () => {
    vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([match]);
    await renderForm("scan", "690000000001");
    await enterBarcode("690000000002");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(container.textContent).toContain("上架前确认收款码");
    await click("上架商品");
    expect(listPaymentQrCodes).toHaveBeenCalledTimes(1);
    expect(createSpotGoods).not.toHaveBeenCalled();
    expect(container.textContent).toContain("请先上传收款码");
  });

  it("keeps a scanned barcode editable after clearing and changing it", async () => {
    vi.mocked(scanLarkBarcode).mockResolvedValueOnce("690000000001");
    await renderForm("scan");
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
    await enterBarcode("");
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "",
    );
    expect(container.textContent).not.toContain("手动输入");
    await enterBarcode("690000000002");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000002",
    );
    expect(getProductTemplatesByBarcode).toHaveBeenLastCalledWith(
      "690000000002",
      expect.objectContaining({ dataSource: "mock" }),
    );
    expect(scanLarkBarcode).toHaveBeenCalledOnce();
  });

  it.each(["", "invalid"])(
    "hides manual barcode input for a legacy manual entry without a valid initial barcode (%s)",
    async (initialBarcode) => {
      await renderForm("manual", initialBarcode);
      expect(container.querySelector("#barcode")).toBeNull();
      expect(container.textContent).not.toContain("手动输入");
      expect(container.textContent).toContain("开始扫码");
      expect(scanLarkBarcode).not.toHaveBeenCalled();
      expect(getProductTemplatesByBarcode).not.toHaveBeenCalled();
    },
  );
});

describe("barcode lookup feedback", () => {
  it("stops increasing initial stock at 999", async () => {
    vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([match]);
    await renderForm("manual", "690000000001");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });
    const increase = container.querySelector<HTMLButtonElement>(
      '[aria-label="增加初始库存"]',
    )!;
    for (let stock = 1; stock < 999; stock += 1) {
      await act(async () => increase.click());
    }
    expect(increase.disabled).toBe(true);
    expect(
      container.querySelector('#stock [aria-live="polite"]')?.textContent,
    ).toBe("999");
    await act(async () => increase.click());
    expect(
      container.querySelector('#stock [aria-live="polite"]')?.textContent,
    ).toBe("999");
  }, 20_000);

  it("associates invalid barcode feedback with the input and removes it after correction", async () => {
    await renderForm("manual", "690000000001");
    await enterBarcode("invalid");

    const input = container.querySelector<HTMLInputElement>("#barcode")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = input.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toContain("数字");
    expect(container.querySelectorAll(`[id="${errorId}"]`)).toHaveLength(1);

    await enterBarcode("690000000002");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(document.getElementById(errorId)).toBeNull();
  });

  it("associates invalid price feedback with the price input before publishing", async () => {
    vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([match]);
    await renderForm("manual", "690000000001");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });
    const input = container.querySelector<HTMLInputElement>("#price")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "0");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("上架商品");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = input.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe(
      "售价至少为 0.01 元",
    );
    expect(ensureAgreement).not.toHaveBeenCalled();
    expect(createSpotGoods).not.toHaveBeenCalled();
  });

  it("keeps the barcode and retries a failed lookup without publishing", async () => {
    vi.mocked(getProductTemplatesByBarcode)
      .mockRejectedValueOnce(new Error("connection unavailable"))
      .mockResolvedValueOnce([match]);
    await renderForm("manual", "690000000001");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "商品匹配失败",
    );
    expect(container.querySelector<HTMLInputElement>("#barcode")?.value).toBe(
      "690000000001",
    );
    await click("重试匹配");

    expect(getProductTemplatesByBarcode).toHaveBeenCalledTimes(2);
    expect(getProductTemplatesByBarcode).toHaveBeenLastCalledWith(
      "690000000001",
      expect.objectContaining({ dataSource: "mock" }),
    );
    expect(container.textContent).toContain("矿泉水");
    expect(createSpotGoods).not.toHaveBeenCalled();
  });

  it("offers template creation for no matches instead of treating it as a network failure", async () => {
    await renderForm("manual", "690000000001");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    const link = Array.from(container.querySelectorAll("a")).find(
      (element) => element.textContent === "创建商品模板",
    );
    expect(link?.getAttribute("href")).toBe(
      "/group/templates?create=1&barcode=690000000001",
    );
    expect(container.textContent).toContain("未找到商品模板");
    expect(container.textContent).not.toContain("重试匹配");
    expect(createSpotGoods).not.toHaveBeenCalled();
  });
});
