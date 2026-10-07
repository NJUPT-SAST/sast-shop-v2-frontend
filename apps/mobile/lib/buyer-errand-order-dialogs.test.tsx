// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerErrandOrderDetail, PaymentBill } from "@sast-shop/api";

const { ensureAgreement, payBill, supplementBillSerialNumber } = vi.hoisted(
  () => ({
    ensureAgreement: vi.fn(),
    payBill: vi.fn(),
    supplementBillSerialNumber: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  listPaymentQrCodes: vi.fn().mockResolvedValue([]),
  payBill,
  supplementBillSerialNumber,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("../components/lark-contact-button", () => ({
  useLarkContactAvailability: () => false,
  LarkContactButton: () => null,
}));
vi.mock("../components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("../components/payment-dialog", () => ({
  PaymentDialog: ({
    open,
    onPay,
  }: {
    open: boolean;
    onPay: (channel: "wechat") => void;
  }) =>
    open ? (
      <div role="dialog">
        <button onClick={() => onPay("wechat")}>确认已支付</button>
      </div>
    ) : null,
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
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { BuyerErrandOrderDetailView } from "../components/buyer-errand-order-detail";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  ensureAgreement.mockReset();
  payBill.mockReset();
  supplementBillSerialNumber.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("buyer errand order drawers", () => {
  it.each([
    ["unpaid", "去支付", "确认已支付"],
    ["submitted", "忘记备注？补充流水号", "确认提交"],
  ] as const)(
    "opens the %s drawer immediately and preserves the submission agreement gate",
    async (status, entry, submit) => {
      let resolveAgreement!: (accepted: boolean) => void;
      ensureAgreement.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveAgreement = resolve;
          }),
      );
      await act(async () =>
        root.render(
          <BuyerErrandOrderDetailView
            order={makeOrder(status)}
            dataSource="local"
            connectBaseUrl="http://127.0.0.1:1323"
          />,
        ),
      );

      await click(entry);
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
      expect(ensureAgreement).not.toHaveBeenCalled();

      if (status === "submitted") {
        const input =
          container.querySelector<HTMLInputElement>("#serial-number")!;
        await act(async () => {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!;
          setter.call(input, "TRACE-123");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      await click(submit);
      expect(ensureAgreement).toHaveBeenCalledTimes(1);
      expect(payBill).not.toHaveBeenCalled();
      expect(supplementBillSerialNumber).not.toHaveBeenCalled();

      await act(async () => resolveAgreement(false));
      expect(payBill).not.toHaveBeenCalled();
      expect(supplementBillSerialNumber).not.toHaveBeenCalled();
    },
  );
});

async function click(label: string) {
  const target = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim().startsWith(label),
  );
  expect(target, `Missing button: ${label}`).toBeDefined();
  await act(async () => target!.click());
}

function makeOrder(status: "unpaid" | "submitted"): BuyerErrandOrderDetail {
  const bill: PaymentBill = {
    id: "9101",
    billNo: "BILL-9101",
    payer: null,
    payee: { id: "42", name: "团长", avatarUrl: "" },
    status,
    amountCents: 100,
    verifyCode: "2718",
    channel: null,
    serialNumber: null,
    submittedAt: null,
    completedAt: null,
    closedAt: null,
    createdAt: null,
    updatedAt: "2026-07-18T02:00:00Z",
    sourceType: "errand_order",
    sourceId: "9001",
  };
  return {
    id: "9001",
    storeId: "3001",
    createdAt: null,
    updatedAt: null,
    store: null,
    status: "pending_payment",
    productItems: [],
    totalOriginAmountCents: 100,
    totalActualAmountCents: 100,
    totalServiceFeeCents: 0,
    captain: null,
    bill,
    deadline: null,
    shoppingStartAt: null,
    shoppingCompletedAt: null,
    distributionCompletedAt: null,
    paymentCompletedAt: null,
    cancelledAt: null,
  };
}
