import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PocketPayment } from "@sast-shop/api";
import { PocketPaymentPage } from "../components/west-pocket/pocket-payment";

const state = vi.hoisted(() => ({
  data: null as PocketPayment | null,
  error: "",
  refresh: vi.fn(),
  poll: vi.fn(),
}));
vi.mock("../components/west-pocket/shared", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../components/west-pocket/shared")
  >()),
  usePocketResource: () => ({
    data: state.data,
    error: state.error,
    refresh: state.refresh,
  }),
  usePocketOptions: () => ({}),
  usePocketAction: () => ({ busy: false, error: "", run: vi.fn() }),
  usePocketPolling: (refresh: () => void, active: boolean) =>
    state.poll(refresh, active),
}));
vi.mock("../components/payment-qr-code", () => ({
  PaymentQrCode: () => <div data-testid="payment-qr">收款码</div>,
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
      billNo: "AA20",
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
function render(pocketId = "12") {
  return renderToStaticMarkup(<PocketPaymentPage pocketId={pocketId} />);
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  state.data = payment();
  state.error = "";
  state.poll.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("West Pocket payment state regression", () => {
  it("shows a fresh unpaid collection and keeps polling before payer submission", () => {
    const html = render();
    expect(html).toContain('data-testid="payment-qr"');
    expect(html).toContain("我已付款");
    expect(state.poll).toHaveBeenCalledWith(state.refresh, true);
  });
  it("suppresses stale unpaid QR and payment controls when state refresh fails", () => {
    state.error = "网络连接失败";
    const html = render();
    expect(html).not.toContain('data-testid="payment-qr"');
    expect(html).not.toContain("保存收款码");
    expect(html).not.toContain("我已付款");
    expect(html).toContain("暂时无法核实最新账单状态");
    expect(html).toContain("重新加载");
  });
  it.each(["cancelling", "cancelled"])(
    "hides cached QR for %s even if a stale bill still says unpaid",
    (status) => {
      state.data = payment(status);
      const html = render();
      expect(html).not.toContain('data-testid="payment-qr"');
      expect(html).not.toContain("我已付款");
      expect(html).toContain("请勿继续转账");
    },
  );
  it("shows cancellation rather than asking to wait for a missing bill", () => {
    state.data = {
      ...payment("cancelled", "closed"),
      bill: null,
      qrContent: "",
    };
    const html = render();
    expect(html).toContain("请勿继续转账");
    expect(html).not.toContain("账单尚未准备好");
  });
  it("does not display a previous activity's QR after navigation", () => {
    const html = render("99");
    expect(html).not.toContain('data-testid="payment-qr"');
    expect(html).not.toContain("我已付款");
  });
  it("describes submitted payment without claiming an unimplemented notification", () => {
    state.data = payment("collecting", "submitted");
    const html = render();
    expect(html).toContain("已标记付款，等待收款人核对到账");
    expect(html).not.toContain("已通知收款人");
    expect(html).not.toContain('data-testid="payment-qr"');
  });
  it("restores payment controls only after a successful fresh collecting response", () => {
    state.error = "暂时无法加载";
    expect(render()).not.toContain('data-testid="payment-qr"');
    state.error = "";
    state.data = payment("collecting", "closed");
    expect(render()).not.toContain('data-testid="payment-qr"');
    state.data = payment();
    expect(render()).toContain('data-testid="payment-qr"');
  });
});
