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
  configureLarkPageJsapi: vi.fn(async () => undefined),
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

  it("keeps manual entry available outside the Feishu SDK", async () => {
    vi.stubGlobal("h5sdk", undefined);
    vi.stubGlobal("tt", undefined);
    await renderForm("scan");

    expect(container.querySelector("#barcode")).not.toBeNull();
    expect(scanLarkBarcode).not.toHaveBeenCalled();
  });

  it("offers retry and manual entry after an SDK scan cancellation", async () => {
    vi.mocked(scanLarkBarcode).mockRejectedValue(new Error("cancelled"));
    await renderForm("scan");

    expect(container.textContent).toContain(
      "已取消扫码，可以重试或手动输入条码",
    );
    await click("手动输入");
    expect(container.querySelector("#barcode")).not.toBeNull();
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
    await renderForm("manual");
    const input = container.querySelector<HTMLInputElement>("#barcode")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "690000000001");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(container.textContent).toContain("上架前确认收款码");
    await click("上架商品");
    expect(listPaymentQrCodes).toHaveBeenCalledTimes(1);
    expect(createSpotGoods).not.toHaveBeenCalled();
    expect(container.textContent).toContain("请先上传收款码");
  });
});
