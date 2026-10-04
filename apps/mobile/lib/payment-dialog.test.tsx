// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentDialog,
  type PaymentDialogProps,
} from "../components/payment-dialog";

vi.mock("@workspace/ui/components/responsive-dialog", () => {
  const Content = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: ReactNode;
    }) => (open ? <div role="dialog">{children}</div> : null),
    ResponsiveDialogContent: Content,
    ResponsiveDialogDescription: Content,
    ResponsiveDialogFooter: Content,
    ResponsiveDialogHeader: Content,
    ResponsiveDialogTitle: Content,
  };
});

vi.mock("../components/payment-qr-code", () => ({
  PaymentQrCode: ({ channel }: { channel: string }) => (
    <div role="img" aria-label={`${channel}收款码`} />
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderPayment(overrides: Partial<PaymentDialogProps> = {}) {
  await act(async () =>
    root.render(
      <PaymentDialog
        open
        onOpenChange={vi.fn()}
        amountCents={450}
        payeeName="校园小卖部"
        verifyCode="2718"
        qrCodes={{ wechat: "wxp://test", alipay: "https://qr.alipay.com/test" }}
        defaultPlatform="wechat"
        status="ready"
        onPay={vi.fn()}
        onCancelPayment={vi.fn()}
        {...overrides}
      />,
    ),
  );
}

describe("payment information", () => {
  it("presents the amount, payee and verification code before either payment QR", async () => {
    await renderPayment();
    const summary = container.querySelector("dl")!;
    expect(summary.textContent).toContain("¥4.50");
    expect(summary.textContent).toContain("校园小卖部");
    expect(summary.textContent).toContain("2718");
    const qr = container.querySelector('[role="img"]')!;
    expect(
      summary.compareDocumentPosition(qr) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const alipay = container.querySelector(
      '[role="tab"][data-state="inactive"]',
    )!;
    await act(async () => {
      alipay.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0 }),
      );
      alipay.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(
      container.querySelector('[aria-label="alipay收款码"]'),
    ).not.toBeNull();
    expect(container.querySelector("dl")).toBe(summary);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "我已支付 · ¥4.50",
      ),
    ).toBe(true);
  });

  it("names missing payee information and prevents submitting while pending", async () => {
    const onPay = vi.fn();
    await renderPayment({ payeeName: null, submitting: true, onPay });
    expect(container.querySelector("dl")?.textContent).toContain("未提供姓名");
    const submit = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "提交中",
    )!;
    expect(submit.disabled).toBe(true);
    await act(async () => submit.click());
    expect(onPay).not.toHaveBeenCalled();
  });
});
