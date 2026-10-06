// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentBill, SpotOrder } from "@sast-shop/api";

const {
  cancelSpotOrder,
  completeSpotOrder,
  confirmBill,
  ensureAgreement,
  getSpotOrderDetail,
  refresh,
  toastInfo,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  cancelSpotOrder: vi.fn(),
  completeSpotOrder: vi.fn(),
  confirmBill: vi.fn(),
  ensureAgreement: vi.fn(),
  getSpotOrderDetail: vi.fn(),
  refresh: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  cancelSpotOrder,
  completeSpotOrder,
  confirmBill,
  getSpotOrderDetail,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("../components/lark-contact-button", () => ({
  useLarkContactAvailability: () => false,
  LarkContactButton: () => null,
}));
vi.mock("../components/mobile-header-actions", () => ({
  MobileHeaderActions: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("../components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));
vi.mock("../components/payment-flow", () => ({
  PaymentSection: () => null,
  SupplementSerialNumberDialog: () => null,
}));
vi.mock("@workspace/ui/components/payment-code-help", () => ({
  PaymentCodeHelp: () => null,
}));
vi.mock("@workspace/ui/components/responsive-dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div role="dialog">{children}</div> : null),
    ResponsiveDialogContent: Wrapper,
    ResponsiveDialogDescription: Wrapper,
    ResponsiveDialogFooter: Wrapper,
    ResponsiveDialogHeader: Wrapper,
    ResponsiveDialogTitle: Wrapper,
  };
});
vi.mock("sonner", () => ({
  toast: { info: toastInfo, success: toastSuccess, error: toastError },
}));

import { SpotOrderDetail } from "../components/spot-order-detail";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  cancelSpotOrder.mockReset();
  completeSpotOrder.mockReset();
  confirmBill.mockReset();
  getSpotOrderDetail.mockReset();
  ensureAgreement.mockReset().mockResolvedValue(true);
  refresh.mockReset();
  toastInfo.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("spot order lifecycle recovery", () => {
  it("locks cancellation at the old version when the response and readback fail", async () => {
    cancelSpotOrder.mockRejectedValue(new Error("响应丢失"));
    getSpotOrderDetail.mockRejectedValue(new Error("读取失败"));
    const initial = makeOrder();
    await renderOrder(initial);

    await cancelOrder();
    expect(cancelSpotOrder).toHaveBeenCalledTimes(1);
    expect(getSpotOrderDetail).toHaveBeenCalledWith(initial.id, {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
    expect(button("取消订单")?.disabled).toBe(true);
    expect(container.textContent).toContain("操作结果待核实");

    await renderOrder({ ...initial, bill: { ...initial.bill! } });
    button("取消订单")?.click();
    expect(cancelSpotOrder).toHaveBeenCalledTimes(1);
  });

  it("uses a cancelled readback without another write or a false success toast", async () => {
    cancelSpotOrder.mockRejectedValueOnce(new Error("响应丢失"));
    getSpotOrderDetail.mockResolvedValueOnce(
      makeOrder({
        status: "cancelled",
        cancelledAt: "2026-07-18T02:05:00Z",
        bill: makeBill({
          status: "closed",
          updatedAt: "2026-07-18T02:05:00Z",
        }),
      }),
    );
    await renderOrder(makeOrder());

    await cancelOrder();
    expect(cancelSpotOrder).toHaveBeenCalledTimes(1);
    expect(button("取消订单")).toBeUndefined();
    expect(toastInfo).toHaveBeenCalledWith("已读取最新订单状态");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("keeps the old version locked when readback is still unchanged", async () => {
    const initial = makeOrder();
    cancelSpotOrder.mockRejectedValueOnce(new Error("响应丢失"));
    getSpotOrderDetail.mockResolvedValueOnce(initial);
    await renderOrder(initial);

    await cancelOrder();
    expect(button("取消订单")?.disabled).toBe(true);
    expect(cancelSpotOrder).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("unlocks cancellation only after a newer order version arrives", async () => {
    cancelSpotOrder.mockRejectedValueOnce(new Error("响应丢失"));
    getSpotOrderDetail.mockRejectedValueOnce(new Error("读取失败"));
    const initial = makeOrder();
    await renderOrder(initial);
    await cancelOrder();
    expect(button("取消订单")?.disabled).toBe(true);

    await renderOrder({
      ...initial,
      bill: makeBill({ updatedAt: "2026-07-18T02:00:00.000000002Z" }),
    });
    expect(button("取消订单")?.disabled).toBe(false);
    cancelSpotOrder.mockResolvedValueOnce(
      makeOrder({ status: "cancelled", cancelledAt: "2026-07-18T02:10:00Z" }),
    );
    await cancelOrder();
    expect(cancelSpotOrder).toHaveBeenCalledTimes(2);
  });

  it("does not write with an old version after agreement while the order changes", async () => {
    cancelSpotOrder.mockResolvedValueOnce(
      makeOrder({ status: "cancelled", cancelledAt: "2026-07-18T02:05:00Z" }),
    );
    let resolveAgreement: (value: boolean) => void = () => {};
    ensureAgreement.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAgreement = resolve;
        }),
    );
    const initial = makeOrder();
    await renderOrder(initial);
    await click("取消订单");
    const submit = button("确认取消");
    expect(submit).toBeDefined();
    await act(async () => submit!.click());

    await renderOrder({
      ...initial,
      status: "cancelled",
      cancelledAt: "2026-07-18T02:05:00Z",
    });
    await act(async () => resolveAgreement(true));
    expect(cancelSpotOrder).not.toHaveBeenCalled();
  });

  it("locks seller confirmation after an ambiguous bill write", async () => {
    confirmBill.mockRejectedValueOnce(new Error("响应丢失"));
    getSpotOrderDetail.mockRejectedValueOnce(new Error("读取失败"));
    await renderOrder(
      makeOrder({ bill: makeBill({ status: "submitted" }) }),
      "seller",
    );

    await click("确认收款");
    await clickDialog("确认已到账");
    expect(confirmBill).toHaveBeenCalledTimes(1);
    expect(button("确认收款")?.disabled).toBe(true);
  });
});

async function renderOrder(
  order: SpotOrder,
  view: "buyer" | "seller" = "buyer",
) {
  await act(async () => {
    root.render(
      <SpotOrderDetail
        order={order}
        view={view}
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1323"
      />,
    );
  });
}

function button(label: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((item) => item.textContent?.trim() === label);
}

async function click(label: string) {
  const target = button(label);
  expect(target, `Missing button: ${label}`).toBeDefined();
  await act(async () => target!.click());
}

async function clickDialog(label: string) {
  const target = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ).find((item) => item.textContent?.trim() === label);
  expect(target, `Missing dialog button: ${label}`).toBeDefined();
  await act(async () => target!.click());
}

async function cancelOrder() {
  await click("取消订单");
  await click("确认取消");
}

function makeOrder(overrides: Partial<SpotOrder> = {}): SpotOrder {
  return {
    id: "5001",
    orderNo: "SO-5001",
    store: null,
    productTitle: "商品",
    productDescription: "",
    productImageUrl: "",
    quantity: 1,
    unitPriceCents: 100,
    totalAmountCents: 100,
    seller: null,
    status: "pending_payment",
    createdAt: "2026-07-18T00:00:00Z",
    paidAt: null,
    completedAt: null,
    cancelledAt: null,
    bill: makeBill(),
    ...overrides,
  };
}

function makeBill(overrides: Partial<PaymentBill> = {}): PaymentBill {
  return {
    id: "9101",
    billNo: "BILL-9101",
    payer: null,
    payee: { id: "42", name: "卖家", avatarUrl: "" },
    status: "unpaid",
    amountCents: 100,
    verifyCode: "2718",
    channel: null,
    serialNumber: null,
    submittedAt: null,
    completedAt: null,
    closedAt: null,
    createdAt: null,
    updatedAt: "2026-07-18T02:00:00.000000001Z",
    sourceType: "spot_order",
    sourceId: "5001",
    ...overrides,
  };
}
