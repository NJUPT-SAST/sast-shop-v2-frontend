// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentBill } from "@sast-shop/api";

const { payBill, getBill, listPaymentQrCodes, supplementBillSerialNumber } =
  vi.hoisted(() => ({
    payBill: vi.fn(),
    getBill: vi.fn(),
    listPaymentQrCodes: vi.fn(),
    supplementBillSerialNumber: vi.fn(),
  }));

vi.mock("@sast-shop/api", () => ({
  getBill,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
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
    }) => (open ? <div role="dialog">{children}</div> : null),
    ResponsiveDialogContent: Content,
    ResponsiveDialogDescription: Content,
    ResponsiveDialogFooter: Content,
    ResponsiveDialogHeader: Content,
    ResponsiveDialogTitle: Content,
  };
});

vi.mock("@/components/payment-dialog", () => ({
  PaymentDialog: ({
    onPay,
    status,
    qrCodes,
  }: {
    onPay: (channel: "wechat") => void;
    status: string;
    qrCodes: { wechat?: string };
  }) => (
    <>
      <button type="button" onClick={() => onPay("wechat")}>
        确认已支付
      </button>
      <output data-testid="payment-state">
        {status}:{qrCodes.wechat ?? ""}
      </output>
    </>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import {
  PaymentSection,
  SupplementSerialNumberDialog,
} from "@/components/payment-flow";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  payBill.mockReset();
  getBill.mockReset();
  listPaymentQrCodes.mockReset();
  listPaymentQrCodes.mockResolvedValue([]);
  supplementBillSerialNumber.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

describe("SupplementSerialNumberDialog ambiguous mutation responses", () => {
  it("recovers a saved serial number when the mutation response is lost", async () => {
    const savedBill = makeBill({
      status: "submitted",
      serialNumber: "TRACE-123",
      updatedAt: "2026-07-18T02:10:00Z",
    });
    supplementBillSerialNumber.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockResolvedValueOnce(savedBill);
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const onBillRefresh = vi.fn();

    await renderSupplementDialog({ onOpenChange, onSuccess, onBillRefresh });
    await enterSerialNumber("TRACE-123");
    await clickSubmitSerialNumber();

    expect(getBill).toHaveBeenCalledWith("9101", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
    expect(onSuccess).toHaveBeenCalledWith(savedBill);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onBillRefresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes the latest bill after a version conflict", async () => {
    const latestBill = makeBill({
      status: "submitted",
      updatedAt: "2026-07-18T02:10:00Z",
    });
    supplementBillSerialNumber.mockRejectedValueOnce(new Error("版本冲突"));
    getBill.mockResolvedValueOnce(latestBill);
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const onBillRefresh = vi.fn();

    await renderSupplementDialog({ onOpenChange, onSuccess, onBillRefresh });
    await enterSerialNumber("TRACE-123");
    await clickSubmitSerialNumber();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onBillRefresh).toHaveBeenCalledWith(latestBill);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(supplementBillSerialNumber).toHaveBeenCalledTimes(1);
  });

  it("closes and blocks retry with the old version when the bill cannot be read", async () => {
    supplementBillSerialNumber.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockRejectedValueOnce(new Error("网络不可用"));
    const onOpenChange = vi.fn();
    const onBillRefresh = vi.fn();

    await renderSupplementDialog({ onOpenChange, onBillRefresh });
    await enterSerialNumber("TRACE-123");
    await clickSubmitSerialNumber();
    await clickSubmitSerialNumber();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onBillRefresh).toHaveBeenCalledWith(null);
    expect(supplementBillSerialNumber).toHaveBeenCalledTimes(1);
  });
});

async function renderSupplementDialog({
  onOpenChange = vi.fn(),
  onSuccess = vi.fn(),
  onBillRefresh = vi.fn(),
}: {
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (bill: PaymentBill) => void;
  onBillRefresh?: (bill: PaymentBill | null) => void;
}) {
  await act(async () => {
    root.render(
      <SupplementSerialNumberDialog
        open
        onOpenChange={onOpenChange}
        billId="9101"
        billUpdatedAt="2026-07-18T02:00:00Z"
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1323"
        onSuccess={onSuccess}
        onBillRefresh={onBillRefresh}
      />,
    );
  });
}

async function enterSerialNumber(value: string) {
  const input = container.querySelector<HTMLInputElement>("#serial-number")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function clickSubmitSerialNumber() {
  const button = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes("确认提交"),
  )!;
  await act(async () => button.click());
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("PaymentSection ambiguous mutation responses", () => {
  it("reports the refreshed submitted bill instead of retrying a payment mutation", async () => {
    const submitted = makeBill({ status: "submitted" });
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockResolvedValueOnce(submitted);
    const onSuccess = vi.fn();
    const onBillRefresh = vi.fn();

    await renderPaymentSection({ onSuccess, onBillRefresh });
    await act(async () => container.querySelector("button")!.click());

    expect(payBill).toHaveBeenCalledTimes(1);
    expect(getBill).toHaveBeenCalledWith("9101", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
    expect(onSuccess).toHaveBeenCalledWith(submitted);
    expect(onBillRefresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes the latest unpaid bill before a retry", async () => {
    const refreshed = makeBill({ updatedAt: "2026-07-18T02:10:00Z" });
    payBill.mockRejectedValueOnce(new Error("版本冲突"));
    getBill.mockResolvedValueOnce(refreshed);
    const onOpenChange = vi.fn();
    const onBillRefresh = vi.fn();

    await renderPaymentSection({ onOpenChange, onBillRefresh });
    await act(async () => container.querySelector("button")!.click());

    expect(onBillRefresh).toHaveBeenCalledWith(refreshed);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("closes and requests an order refresh when the bill cannot be read", async () => {
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockRejectedValueOnce(new Error("网络不可用"));
    const onOpenChange = vi.fn();
    const onBillRefresh = vi.fn();

    await renderPaymentSection({ onOpenChange, onBillRefresh });
    await act(async () => container.querySelector("button")!.click());

    expect(onBillRefresh).toHaveBeenCalledWith(null);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(payBill).toHaveBeenCalledTimes(1);
  });

  it("blocks reopening and paying the same unverified bill version", async () => {
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockRejectedValueOnce(new Error("网络不可用"));
    const onOpenChange = vi.fn();
    const onBillRefresh = vi.fn();

    await renderPaymentSection({ onOpenChange, onBillRefresh });
    await act(async () => container.querySelector("button")!.click());
    await renderPaymentSection({ open: false, onOpenChange, onBillRefresh });
    await renderPaymentSection({ onOpenChange, onBillRefresh });
    await act(async () => container.querySelector("button")!.click());

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onBillRefresh).toHaveBeenCalledWith(null);
    expect(payBill).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.textContent).toContain("error:");
  });

  it("allows payment after a newer bill version replaces the unverified one", async () => {
    const newerBill = makeBill({ updatedAt: "2026-07-18T02:10:00Z" });
    payBill.mockRejectedValueOnce(new Error("响应中断"));
    getBill.mockRejectedValueOnce(new Error("网络不可用"));
    payBill.mockResolvedValueOnce({ ...newerBill, status: "submitted" });

    await renderPaymentSection({});
    await act(async () => container.querySelector("button")!.click());
    await renderPaymentSection({ open: false, bill: newerBill });
    await renderPaymentSection({ bill: newerBill });
    await act(async () => container.querySelector("button")!.click());

    expect(payBill).toHaveBeenCalledTimes(2);
    expect(payBill).toHaveBeenLastCalledWith(
      { billId: "9101", channel: "wechat", updatedAt: newerBill.updatedAt },
      { dataSource: "local", connectBaseUrl: "http://127.0.0.1:1323" },
    );
  });

  it("does not show an old payee QR result after the drawer closes and reopens", async () => {
    let resolveOldQr!: (
      value: Array<{ channel: string; content: string }>,
    ) => void;
    listPaymentQrCodes.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOldQr = resolve;
      }),
    );

    await renderPaymentSection({ open: true });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 1)));
    await renderPaymentSection({ open: false });
    await act(async () =>
      resolveOldQr([{ channel: "wechat", content: "旧收款码" }]),
    );
    await renderPaymentSection({ open: true });

    expect(container.querySelector("output")?.textContent).toBe("loading:");
  });
});

async function renderPaymentSection({
  onOpenChange = vi.fn(),
  onSuccess = vi.fn(),
  onBillRefresh = vi.fn(),
  open = true,
  bill = makeBill(),
}: {
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (bill: PaymentBill) => void;
  onBillRefresh?: (bill: PaymentBill | null) => void;
  open?: boolean;
  bill?: PaymentBill;
}) {
  await act(async () => {
    root.render(
      <PaymentSection
        open={open}
        onOpenChange={onOpenChange}
        bill={
          bill as PaymentBill & {
            updatedAt: string;
            payee: NonNullable<PaymentBill["payee"]>;
          }
        }
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1323"
        onSuccess={onSuccess}
        onBillRefresh={onBillRefresh}
      />,
    );
  });
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
    updatedAt: "2026-07-18T02:00:00Z",
    sourceType: "spot_order",
    sourceId: "5001",
    ...overrides,
  };
}
