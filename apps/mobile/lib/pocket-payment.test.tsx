// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PocketPayment } from "@sast-shop/api";
import { PocketPaymentSection } from "../components/pocket/pocket-payment";

const state = vi.hoisted(() => ({
  data: null as PocketPayment | null,
  error: "",
  busy: false,
  pending: false,
  refresh: vi.fn(),
  poll: vi.fn(),
  run: vi.fn(),
  setData: vi.fn(),
  payBill: vi.fn(),
  listPaymentQrCodes: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  payBill: state.payBill,
  listPaymentQrCodes: state.listPaymentQrCodes,
}));
vi.mock("../components/pocket/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../components/pocket/shared")>()),
  usePocketResource: () => ({
    data: state.data,
    error: state.error,
    refresh: state.refresh,
    refreshFresh: state.refresh,
    setData: state.setData,
  }),
  usePocketOptions: () => ({}),
  usePocketAction: () => ({
    busy: state.busy,
    pending: state.pending,
    error: "",
    run: state.run,
    recover: state.refresh,
  }),
  usePocketPolling: (refresh: () => void, active: boolean) =>
    state.poll(refresh, active),
}));
vi.mock("../components/payment-qr-code", () => ({
  PaymentQrCode: ({
    content,
    channel,
  }: {
    content: string;
    channel: string;
  }) => (
    <div data-testid="payment-qr" data-content={content} data-channel={channel}>
      收款码
    </div>
  ),
}));
vi.mock("@workspace/ui/components/responsive-dialog", () => {
  const Content = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveDialog: ({
      open,
      children,
      dismissible,
    }: {
      open: boolean;
      children: ReactNode;
      dismissible?: boolean;
    }) =>
      open ? (
        <div role="dialog" data-dismissible={dismissible}>
          {children}
        </div>
      ) : null,
    ResponsiveDialogContent: Content,
    ResponsiveDialogDescription: Content,
    ResponsiveDialogFooter: Content,
    ResponsiveDialogHeader: Content,
    ResponsiveDialogTitle: Content,
  };
});
vi.mock("../components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  ),
}));

function payment(
  status = "collecting",
  billStatus: NonNullable<PocketPayment["bill"]>["status"] = "unpaid",
): PocketPayment {
  return {
    pocket: {
      id: "12",
      ownerId: "1",
      title: "聚餐",
      totalCents: 10000,
      status,
      revision: "3",
      participantCount: 3,
      ownerShareCents: 3334,
      receivableCents: 6666,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      cancelReason: "",
      isOwner: false,
      owner: { id: "1", name: "同学甲", avatarUrl: "" },
    },
    bill: {
      id: "20",
      billNo: "POCKET-20",
      payer: { id: "2", name: "同学乙", avatarUrl: "" },
      payee: { id: "1", name: "同学甲", avatarUrl: "" },
      status: billStatus,
      amountCents: 3333,
      verifyCode: "1234",
      channel: "wechat",
      serialNumber: null,
      submittedAt: null,
      completedAt: null,
      closedAt: null,
      createdAt: null,
      updatedAt: "2026-09-23T12:00:00.123456789Z",
      sourceType: "west_pocket",
      sourceId: "12",
    },
    payee: { id: "1", name: "同学甲", avatarUrl: "" },
    qrContent: "wxp://published-snapshot",
    isOwner: false,
  };
}
function render(pocketId = "12", initiallyOpen = false) {
  return renderToStaticMarkup(
    <PocketPaymentSection pocketId={pocketId} initiallyOpen={initiallyOpen} />,
  );
}
function page() {
  const element = document.createElement("div");
  element.innerHTML = render();
  return element;
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.data = payment();
  state.error = "";
  state.busy = false;
  state.pending = false;
  state.poll.mockClear();
  state.refresh.mockReset().mockImplementation(async () => state.data);
  state.run
    .mockReset()
    .mockImplementation(
      async (_key: string, operation: (requestId: string) => Promise<void>) =>
        operation("test-request"),
    );
  state.setData.mockReset().mockImplementation((value: PocketPayment) => {
    state.data = value;
  });
  state.payBill.mockReset().mockImplementation(async () => ({
    ...state.data!.bill,
    status: "submitted",
    updatedAt: "2026-09-23T12:00:01.123456789Z",
  }));
  state.listPaymentQrCodes.mockReset();
});
let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

async function mount(pocketId = "12") {
  if (!container) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  await act(async () =>
    root!.render(<PocketPaymentSection pocketId={pocketId} />),
  );
  return container;
}

function button(element: HTMLElement, text: string) {
  const found = Array.from(element.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  expect(found).toBeDefined();
  return found!;
}

describe("West Pocket payment state regression", () => {
  it("shows a fresh unpaid collection and keeps polling before payer submission", () => {
    const html = render();
    expect(html).not.toContain('data-testid="payment-qr"');
    expect(html).toContain("支付账单");
    expect(html).toContain("去付款");
    expect(state.poll).toHaveBeenCalledWith(state.refresh, true);
  });
  it("keeps the payer action in the fixed footer and disables it during a write", () => {
    const footer = page().querySelector("footer");
    expect(footer?.querySelector("button")?.textContent).toBe("去付款");
    expect(footer?.querySelector("button")?.disabled).toBe(false);
    state.busy = true;
    expect(
      page().querySelector("footer button")?.hasAttribute("disabled"),
    ).toBe(true);
  });
  it("hides the QR and payment footer while the previous write is unverified", () => {
    state.pending = true;
    const element = page();
    expect(element.querySelector('[data-testid="payment-qr"]')).toBeNull();
    expect(element.querySelector("footer")).toBeNull();
    expect(element.textContent).not.toContain("账单或收款码尚未准备好");
  });
  it("keeps recipient, amount, verification code and status together without repeating QR numbers", () => {
    const element = page();
    const bill = element.querySelector('section[aria-label="我的分摊账单"]');
    expect(bill?.textContent).toContain("同学甲");
    expect(bill?.textContent).toContain("微信");
    expect(bill?.textContent).toContain("POCKET-20");
    expect(bill?.querySelector('[aria-label="复制账单号"]')).not.toBeNull();
    expect(bill?.querySelector('[aria-label="复制付款标识码"]')).not.toBeNull();
    expect(bill?.textContent).toContain("待支付");
    expect(element.textContent?.match(/¥33\.33/g)).toHaveLength(1);
    expect(element.textContent?.match(/1234/g)).toHaveLength(1);
  });
  it.each([
    ["submitted", "待确认收款"],
    ["completed", "已完成"],
  ] as const)("shows one %s status inside the bill card", (status, message) => {
    state.data = payment("collecting", status);
    const element = page();
    const bill = element.querySelector('section[aria-label="我的分摊账单"]');
    expect(bill?.textContent).toContain(message);
    expect(bill?.textContent?.match(new RegExp(message, "g"))).toHaveLength(1);
    expect(element.querySelector("footer")).toBeNull();
  });
  it("suppresses stale unpaid QR and payment controls when state refresh fails", () => {
    state.error = "网络连接失败";
    const html = render();
    expect(html).not.toContain('data-testid="payment-qr"');
    expect(html).not.toContain("保存收款码");
    expect(html).not.toContain("去付款");
    expect(html).toContain("暂时无法核实最新账单状态");
    expect(html).toContain("重新加载");
  });
  it.each(["cancelling", "cancelled"])(
    "hides cached QR for %s even if a stale bill still says unpaid",
    (status) => {
      state.data = payment(status);
      const html = render();
      expect(html).not.toContain('data-testid="payment-qr"');
      expect(html).not.toContain("去付款");
      expect(html).toContain("请勿转账");
    },
  );
  it("shows cancellation rather than asking to wait for a missing bill", () => {
    state.data = {
      ...payment("cancelled", "closed"),
      bill: null,
      qrContent: "",
    };
    const html = render();
    expect(html).toContain("请勿转账");
    expect(html).not.toContain("账单暂未就绪");
  });
  it("does not display a previous activity's QR after navigation", () => {
    const html = render("99", true);
    expect(html).not.toContain('data-testid="payment-qr"');
    expect(html).not.toContain("去付款");
    expect(html).not.toContain("POCKET-20");
    expect(html).not.toContain("同学甲");
  });
  it("describes submitted payment without claiming an unimplemented notification", () => {
    state.data = payment("collecting", "submitted");
    const html = render();
    expect(html).toContain("付款信息已提交，等待收款人核对到账");
    expect(html).not.toContain("已通知收款人");
    expect(html).not.toContain('data-testid="payment-qr"');
  });
  it("restores payment controls only after a successful fresh collecting response", () => {
    state.error = "暂时无法加载";
    expect(render()).not.toContain("去付款");
    state.error = "";
    state.data = payment("collecting", "closed");
    expect(render()).not.toContain("去付款");
    state.data = payment();
    expect(render()).toContain("去付款");
    expect(render()).not.toContain('data-testid="payment-qr"');
  });

  it("does not offer a payer action or payer bill to the collecting owner", () => {
    state.data = { ...payment(), isOwner: true };
    const html = render("12", true);
    expect(html).toContain("无需向自己转账");
    expect(html).not.toContain("去付款");
    expect(html).not.toContain("POCKET-20");
    expect(html).not.toContain('data-testid="payment-qr"');
  });

  it.each(["timestamp", "qr"] as const)(
    "blocks payment when the %s is missing",
    (missing) => {
      state.data = payment();
      if (missing === "timestamp") state.data.bill!.updatedAt = null;
      else state.data.qrContent = "";
      const html = render("12", true);
      expect(html).not.toContain("去付款");
      expect(html).not.toContain('data-testid="payment-qr"');
      expect(html).toContain("账单或收款码尚未准备好");
    },
  );

  it("opens the real shared payment dialog with only the published WeChat snapshot", async () => {
    const element = await mount();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('[data-testid="payment-qr"]')).toBeNull();
    await act(async () => button(element, "去付款").click());
    const dialog = element.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain("支付");
    expect(dialog.textContent).not.toContain("支付宝");
    expect(dialog.querySelectorAll('[data-testid="payment-qr"]')).toHaveLength(
      1,
    );
    expect(
      dialog
        .querySelector('[data-testid="payment-qr"]')
        ?.getAttribute("data-content"),
    ).toBe("wxp://published-snapshot");
    expect(
      dialog
        .querySelector('[data-testid="payment-qr"]')
        ?.getAttribute("data-channel"),
    ).toBe("wechat");
    expect(state.listPaymentQrCodes).not.toHaveBeenCalled();
    await act(async () => button(dialog, "稍后支付").click());
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(state.payBill).not.toHaveBeenCalled();
  });

  it("submits the exact bill version through the shared payment dialog", async () => {
    const element = await mount();
    await act(async () => button(element, "去付款").click());
    const dialog = element.querySelector<HTMLElement>('[role="dialog"]')!;
    const submit = button(dialog, "我已支付 · ¥33.33");
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(state.payBill).toHaveBeenCalledExactlyOnceWith(
      {
        billId: "20",
        channel: "wechat",
        updatedAt: "2026-09-23T12:00:00.123456789Z",
      },
      {},
    );
    expect(state.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        bill: expect.objectContaining({ status: "submitted" }),
      }),
    );
    expect(state.refresh).toHaveBeenCalledOnce();
    await mount();
    expect(element.textContent).toContain("已提交支付确认");
    expect(element.querySelector('[data-testid="payment-qr"]')).toBeNull();
  });

  it("removes an already-open stale QR when a new activity replaces the route", async () => {
    const element = await mount();
    await act(async () => button(element, "去付款").click());
    expect(
      element
        .querySelector('[data-testid="payment-qr"]')
        ?.getAttribute("data-content"),
    ).toBe("wxp://published-snapshot");
    await mount("99");
    expect(element.querySelector('[data-testid="payment-qr"]')).toBeNull();
    expect(element.textContent).not.toContain("POCKET-20");
    expect(element.textContent).not.toContain("同学甲");
    expect(state.payBill).not.toHaveBeenCalled();
    const next = payment();
    next.pocket.id = "99";
    next.bill!.id = "99";
    next.bill!.billNo = "POCKET-99";
    next.bill!.sourceId = "99";
    next.qrContent = "wxp://another-published-snapshot";
    state.data = next;
    await mount("99");
    expect(
      element
        .querySelector('[data-testid="payment-qr"]')
        ?.getAttribute("data-content"),
    ).toBe("wxp://another-published-snapshot");
    expect(element.textContent).not.toContain("POCKET-20");
  });

  it.each(["load-error", "pending", "cancelling", "closed"] as const)(
    "removes an open payment QR when %s invalidates payment",
    async (reason) => {
      const element = await mount();
      await act(async () => button(element, "去付款").click());
      if (reason === "load-error") state.error = "网络连接失败";
      else if (reason === "pending") state.pending = true;
      else if (reason === "cancelling")
        state.data!.pocket.status = "cancelling";
      else state.data!.bill!.status = "closed";
      await mount();
      expect(element.querySelector('[data-testid="payment-qr"]')).toBeNull();
      expect(element.textContent).not.toContain("我已支付");
      expect(element.querySelector("footer")).toBeNull();
      expect(state.payBill).not.toHaveBeenCalled();
    },
  );

  it("keeps the payment dialog and local close action locked during a write", async () => {
    const element = await mount();
    await act(async () => button(element, "去付款").click());
    state.busy = true;
    await mount();
    const dialog = element.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("data-dismissible")).toBe("false");
    const close = button(dialog, "稍后支付");
    expect(close.disabled).toBe(true);
    await act(async () => close.click());
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button(element, "去付款").disabled).toBe(true);
  });
});
