// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ListSpotGoodsResult,
  PaymentBill,
  SpotGoods,
} from "@sast-shop/api";
import { SpotMarketplace } from "../components/spot-marketplace";

const {
  createSpotOrders,
  getBill,
  getSpotGoods,
  listPaymentQrCodes,
  payBill,
  refresh,
  toastError,
  toastInfo,
} = vi.hoisted(() => ({
  createSpotOrders: vi.fn(),
  getBill: vi.fn(),
  getSpotGoods: vi.fn(),
  listPaymentQrCodes: vi.fn(),
  payBill: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("@sast-shop/api", () => ({
  createSpotOrders,
  getBill,
  getSpotGoods,
  listPaymentQrCodes,
  listSpotGoods: vi.fn(),
  payBill,
}));
vi.mock("sonner", () => ({
  toast: { error: toastError, info: toastInfo, success: vi.fn() },
}));
vi.mock("../lib/payment-preferences", () => ({
  readDefaultPaymentPlatform: () => "wechat",
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <div aria-label={alt} />,
}));
vi.mock("@workspace/ui/hooks/use-infinite-page", () => ({
  useInfinitePage: ({
    initialPage,
  }: {
    initialPage: { items: ListSpotGoodsResult["goods"] };
  }) => ({
    items: initialPage.items,
    loadingMore: false,
    loadMoreError: null,
    hasMore: false,
    totalCount: initialPage.items.length,
    loadMore: vi.fn(),
  }),
}));
vi.mock("@workspace/ui/components/responsive-dialog", () => {
  const Content = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div>{children}</div> : null),
    ResponsiveDialogContent: Content,
    ResponsiveDialogDescription: Content,
    ResponsiveDialogFooter: Content,
    ResponsiveDialogHeader: Content,
    ResponsiveDialogTitle: Content,
  };
});
vi.mock("../components/payment-dialog", () => ({
  PaymentDialog: ({
    open,
    status,
    onPay,
    onRetry,
    onOpenChange,
  }: {
    open: boolean;
    status: string;
    onPay: (platform: "wechat") => void;
    onRetry: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="payment-dialog">
        <output data-testid="payment-status">{status}</output>
        <button type="button" onClick={() => onPay("wechat")}>
          确认支付
        </button>
        <button type="button" onClick={onRetry}>
          重试收款码
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          关闭支付
        </button>
      </div>
    ) : null,
}));

const bill: PaymentBill = {
  id: "9101",
  billNo: "BILL-9101",
  payer: null,
  payee: { id: "42", name: "卖家", avatarUrl: "" },
  status: "unpaid",
  amountCents: 200,
  verifyCode: "2718",
  channel: null,
  serialNumber: null,
  submittedAt: null,
  completedAt: null,
  closedAt: null,
  createdAt: null,
  updatedAt: "2026-07-18T02:00:00Z",
  sourceType: "spot_order",
  sourceId: "5001",
};
const product = {
  id: "4001",
  title: "矿泉水",
  description: "550ml",
  priceCents: 250,
  storeId: "3001",
  mainImageUrl: "",
  barcode: "690000000001",
  updatedAt: "2026-07-18T01:00:00Z",
};
const store = {
  id: "3001",
  name: "SAST 小卖部",
  address: "南邮仙林校区",
  logoUrl: "",
  themeColor: "#0071e3",
};
const initialPage: ListSpotGoodsResult = {
  goods: [
    {
      id: "5001",
      product,
      salePriceCents: 200,
      updatedAt: "2026-07-18T01:00:00Z",
      store,
    },
  ],
  currentPage: 1,
  pageSize: 10,
  totalCount: 1,
};
const detail: SpotGoods = {
  id: "5001",
  product,
  salePriceCents: 200,
  stock: 5,
  sellerId: "42",
  sellerName: "卖家",
  sellerAvatarUrl: "",
  updatedAt: "2026-07-18T01:00:00Z",
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  createSpotOrders.mockReset().mockResolvedValue([{ bill }]);
  getBill.mockReset();
  getSpotGoods.mockReset().mockResolvedValue(detail);
  listPaymentQrCodes
    .mockReset()
    .mockResolvedValue([
      { channel: "wechat", content: "https://example.com/pay" },
    ]);
  payBill.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function click(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent?.includes(text),
  );
  expect(button, `Missing button: ${text}`).toBeDefined();
  await act(async () => button!.click());
}

async function openPayment() {
  await act(async () => {
    root.render(
      <SpotMarketplace
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1323"
        initialPage={initialPage}
        error={null}
      />,
    );
  });
  await click("矿泉水");
  await click("创建订单");
  expect(
    container.querySelector('[data-testid="payment-status"]')?.textContent,
  ).toBe("ready");
}

describe("new spot order payment recovery", () => {
  it("uses the refreshed submitted bill after an ambiguous pay response", async () => {
    const submitted = { ...bill, status: "submitted" };
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockResolvedValueOnce(submitted);
    await openPayment();

    await click("确认支付");

    expect(getBill).toHaveBeenCalledWith("9101", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
    expect(
      container.querySelector('[data-testid="payment-status"]')?.textContent,
    ).toBe("submitted");
    expect(toastInfo).toHaveBeenCalledWith("已读取最新支付状态");
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("closes the old bill after a failed pay and fresh unpaid response", async () => {
    const refreshed = { ...bill, updatedAt: "2026-07-18T02:10:00Z" };
    payBill.mockRejectedValueOnce(new Error("版本冲突"));
    getBill.mockResolvedValueOnce(refreshed);
    await openPayment();

    await click("确认支付");

    expect(
      container.querySelector('[data-testid="payment-dialog"]'),
    ).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "支付确认未完成，账单已刷新，请核对后重试",
    );
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("closes and refreshes when the bill cannot be read", async () => {
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockRejectedValueOnce(new Error("网络中断"));
    await openPayment();

    await click("确认支付");

    expect(
      container.querySelector('[data-testid="payment-dialog"]'),
    ).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "无法确认支付结果，正在刷新订单，请核对后再操作",
    );
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate pay requests while the first request is pending", async () => {
    let resolvePay!: (value: PaymentBill) => void;
    payBill.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePay = resolve;
      }),
    );
    await openPayment();

    const payButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "确认支付",
    )!;
    await act(async () => {
      payButton.click();
      payButton.click();
    });
    expect(payBill).toHaveBeenCalledTimes(1);

    await act(async () => resolvePay({ ...bill, status: "submitted" }));
    expect(
      container.querySelector('[data-testid="payment-status"]')?.textContent,
    ).toBe("submitted");
  });

  it("does not restore payment UI after it closes during a bill refresh", async () => {
    let resolveBill!: (value: PaymentBill) => void;
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBill = resolve;
      }),
    );
    await openPayment();

    await click("确认支付");
    await click("关闭支付");
    await act(async () => resolveBill({ ...bill, status: "submitted" }));

    expect(
      container.querySelector('[data-testid="payment-dialog"]'),
    ).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not reopen a closed drawer when an old QR retry resolves", async () => {
    let resolveRetry!: (
      value: Array<{ channel: string; content: string }>,
    ) => void;
    listPaymentQrCodes
      .mockResolvedValueOnce([{ channel: "wechat", content: "old" }])
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
      );
    await openPayment();

    await click("重试收款码");
    await click("关闭支付");
    await act(async () =>
      resolveRetry([{ channel: "wechat", content: "new" }]),
    );

    expect(
      container.querySelector('[data-testid="payment-dialog"]'),
    ).toBeNull();
  });
});
