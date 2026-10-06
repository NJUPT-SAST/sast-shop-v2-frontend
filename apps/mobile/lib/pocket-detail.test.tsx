// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentBill, PocketDetail, PocketPayment } from "@sast-shop/api";
import { PocketDetailPage } from "../components/pocket/pocket-detail";
import { PocketPaymentSection } from "../components/pocket/pocket-payment";

const rpc = vi.hoisted(() => ({
  getPocket: vi.fn(),
  getBill: vi.fn(),
  getPocketPayment: vi.fn(),
  payBill: vi.fn(),
  confirmBill: vi.fn(),
  rejectPocketPayment: vi.fn(),
  updatePocket: vi.fn(),
  cancelPocket: vi.fn(),
  ensureAgreement: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getPocket: rpc.getPocket,
  getBill: rpc.getBill,
  getPocketPayment: rpc.getPocketPayment,
  payBill: rpc.payBill,
  confirmBill: rpc.confirmBill,
  rejectPocketPayment: rpc.rejectPocketPayment,
  updatePocket: rpc.updatePocket,
  cancelPocket: rpc.cancelPocket,
}));
vi.mock("../components/mobile-header-actions", () => ({
  MobileHeaderActions: ({ children }: { children: ReactNode }) => (
    <aside>{children}</aside>
  ),
}));
vi.mock("../components/pocket/members-drawer", () => ({
  PocketMembersDrawer: ({ detail }: { detail: PocketDetail }) => (
    <div
      aria-label="分摊人选择"
      data-revision={detail.pocket.revision}
      data-total={detail.pocket.totalCents}
    />
  ),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: rpc.ensureAgreement }),
}));
vi.mock("../components/pocket/pocket-album", () => ({
  PocketAlbum: () => null,
}));
vi.mock("../components/payment-qr-code", () => ({
  PaymentQrCode: () => <div>收款码</div>,
}));
vi.mock("../components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
}));
vi.mock("@workspace/ui/components/responsive-dialog", () => {
  const Section = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: ReactNode;
    }) => (open ? <section role="dialog">{children}</section> : null),
    ResponsiveDialogContent: Section,
    ResponsiveDialogDescription: Section,
    ResponsiveDialogHeader: Section,
    ResponsiveDialogTitle: ({ children }: { children: ReactNode }) => (
      <h2>{children}</h2>
    ),
    ResponsiveDialogFooter: ({ children }: { children: ReactNode }) => (
      <footer>{children}</footer>
    ),
  };
});
vi.mock("@workspace/ui/components/drawer", () => {
  const Section = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <section role="dialog">{children}</section> : null,
    DrawerContent: Section,
    DrawerDescription: Section,
    DrawerHeader: Section,
    DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DrawerFooter: ({ children }: { children: ReactNode }) => (
      <footer>{children}</footer>
    ),
    DrawerTrigger: ({ children }: { children: ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

const owner = { id: "1", name: "同学甲", avatarUrl: "" };
const payer = { id: "2", name: "同学乙", avatarUrl: "" };
let bill: PaymentBill;
let detail: PocketDetail;
let root: Root;
let container: HTMLDivElement;

function button(text: string, scope: ParentNode = container) {
  const result = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === text,
  );
  expect(result).toBeDefined();
  return result!;
}
function dialog() {
  const result = container.querySelector<HTMLElement>('[role="dialog"]');
  expect(result).not.toBeNull();
  return result!;
}
function consent() {
  return dialog().querySelector<HTMLButtonElement>('[role="checkbox"]')!;
}
async function click(text: string, scope: ParentNode = container) {
  await act(async () => button(text, scope).click());
}
async function mount(perspective: "owner" | "payer") {
  if (perspective === "payer") bill.status = "unpaid";
  await act(async () =>
    root.render(
      perspective === "owner" ? (
        <PocketDetailPage pocketId="12" />
      ) : (
        <PocketPaymentSection pocketId="12" />
      ),
    ),
  );
  await click(perspective === "owner" ? "核对到账" : "去付款");
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  bill = {
    id: "20",
    billNo: "POCKET-20",
    payer,
    payee: owner,
    status: "submitted",
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
  };
  detail = {
    pocket: {
      id: "12",
      ownerId: "1",
      owner,
      title: "聚餐",
      totalCents: 10000,
      status: "collecting",
      revision: "3",
      participantCount: 3,
      ownerShareCents: 3334,
      receivableCents: 6666,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      cancelReason: "",
      isOwner: true,
    },
    isOwner: true,
    members: [
      {
        id: "5",
        userId: payer.id,
        user: payer,
        selectionSource: "search",
        faceMatchId: null,
        shareCents: 3333,
        paymentBillId: "20",
        billStatus: "submitted",
        billUpdatedAt: bill.updatedAt,
        isOwner: false,
        albumAccess: "pending",
      },
    ],
    photos: [],
    jobs: [],
    notifications: [],
  };
  rpc.getPocket.mockReset().mockImplementation(async () => detail);
  rpc.getBill.mockReset().mockImplementation(async () => ({ ...bill }));
  rpc.getPocketPayment
    .mockReset()
    .mockImplementation(async (): Promise<PocketPayment> => ({
      pocket: { ...detail.pocket, isOwner: false },
      bill: { ...bill },
      payee: owner,
      qrContent: "wxp://published-snapshot",
      isOwner: false,
    }));
  rpc.ensureAgreement.mockReset().mockResolvedValue(true);
  rpc.payBill.mockReset().mockImplementation(async () => {
    bill = { ...bill, status: "submitted" };
    return bill;
  });
  rpc.confirmBill.mockReset().mockResolvedValue(undefined);
  rpc.rejectPocketPayment.mockReset().mockResolvedValue(undefined);
  rpc.updatePocket
    .mockReset()
    .mockImplementation(
      async (input: { title?: string; totalCents?: number }) => {
        detail = {
          ...detail,
          pocket: {
            ...detail.pocket,
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.totalCents === undefined
              ? {}
              : { totalCents: input.totalCents }),
            revision: String(Number(detail.pocket.revision) + 1),
          },
        };
        return detail.pocket;
      },
    );
  rpc.cancelPocket.mockReset().mockImplementation(async () => {
    detail = { ...detail, pocket: { ...detail.pocket, status: "cancelled" } };
    return detail.pocket;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mountDraft() {
  vi.useFakeTimers();
  detail = {
    ...detail,
    pocket: { ...detail.pocket, status: "draft" },
    members: [],
  };
  await act(async () => root.render(<PocketDetailPage pocketId="12" />));
}
async function inputValue(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

describe("Pocket draft editing", () => {
  it("refreshes after a page refresh without replacing an unsaved amount", async () => {
    await mountDraft();
    await inputValue("draft-amount", "75.55");
    const reads = rpc.getPocket.mock.calls.length;
    await act(async () =>
      root.render(
        <PocketDetailPage pocketId="12" refreshKey="new-page-render" />,
      ),
    );
    expect(rpc.getPocket).toHaveBeenCalledTimes(reads + 1);
    expect(
      container.querySelector<HTMLInputElement>("#draft-amount")!.value,
    ).toBe("75.55");
    expect(rpc.updatePocket).not.toHaveBeenCalled();
  });

  it("waits for leaving the amount field and cancels the debounce when editing resumes", async () => {
    await mountDraft();
    const input = await inputValue("draft-amount", "75.55");
    await advance(1000);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    expect(button("选择分摊人").disabled).toBe(true);
    await act(async () => input.blur());
    await advance(600);
    await act(async () => input.focus());
    await advance(1000);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    await act(async () => input.blur());
    await advance(700);
    expect(rpc.updatePocket).toHaveBeenCalledExactlyOnceWith(
      {
        pocketId: "12",
        expectedRevision: "3",
        totalCents: 7555,
        requestId: expect.any(String),
      },
      {},
    );
    expect(button("选择分摊人").disabled).toBe(false);
    await click("选择分摊人");
    const members = container.querySelector('[aria-label="分摊人选择"]');
    expect(members?.getAttribute("data-revision")).toBe("4");
    expect(members?.getAttribute("data-total")).toBe("7555");
    expect(container.textContent).not.toContain("保存金额与名称");
  });

  it("keeps empty or invalid amounts and does not write an unchanged amount", async () => {
    await mountDraft();
    let input = await inputValue("draft-amount", "100.00");
    await act(async () => input.blur());
    await advance(1000);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    input = await inputValue("draft-amount", "");
    await act(async () => input.blur());
    await advance(1000);
    expect(input.value).toBe("");
    expect(button("选择分摊人").disabled).toBe(true);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
  });

  it("offers explicit retry after agreement refusal without repeatedly opening the agreement", async () => {
    rpc.ensureAgreement.mockResolvedValue(false);
    await mountDraft();
    const input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(700);
    expect(rpc.ensureAgreement).toHaveBeenCalledOnce();
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    await advance(3000);
    expect(rpc.ensureAgreement).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("金额尚未保存，请重试");
    rpc.ensureAgreement.mockResolvedValue(true);
    await click("重新加载");
    expect(rpc.updatePocket).toHaveBeenCalledOnce();
    expect(button("选择分摊人").disabled).toBe(false);
  });

  it("submits a name separately with the latest revision after an amount save", async () => {
    await mountDraft();
    const input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(700);
    expect(container.querySelector("#draft-title")).toBeNull();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="修改聚餐名称"]')!
        .click(),
    );
    await inputValue("draft-title", "  周五晚饭  ");
    await click("完成");
    expect(rpc.updatePocket).toHaveBeenNthCalledWith(
      2,
      {
        pocketId: "12",
        expectedRevision: "4",
        title: "周五晚饭",
        requestId: expect.any(String),
      },
      {},
    );
    expect(container.querySelector("h1")?.textContent).toBe("周五晚饭");
    expect(
      container.querySelector<HTMLInputElement>("#draft-amount")?.value,
    ).toBe("75.55");
  });

  it("keeps a conflicting amount draft and retries against the refreshed revision with a new request ID", async () => {
    await mountDraft();
    rpc.updatePocket.mockImplementationOnce(async () => {
      detail = {
        ...detail,
        pocket: { ...detail.pocket, totalCents: 9000, revision: "8" },
      };
      throw new Error("版本冲突");
    });
    const input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(700);
    expect(input.value).toBe("75.55");
    expect(button("选择分摊人").disabled).toBe(true);
    await advance(2000);
    expect(rpc.updatePocket).toHaveBeenCalledOnce();
    await click("重新加载");
    const [first, second] = rpc.updatePocket.mock.calls.map((call) => call[0]);
    expect(second.expectedRevision).toBe("8");
    expect(second.totalCents).toBe(7555);
    expect(second.requestId).not.toBe(first.requestId);
    expect(button("选择分摊人").disabled).toBe(false);
  });

  it("pauses the amount debounce for name editing and resumes with the new revision", async () => {
    await mountDraft();
    const amount = await inputValue("draft-amount", "75.55");
    await act(async () => amount.blur());
    await advance(300);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="修改聚餐名称"]')!
        .click(),
    );
    await inputValue("draft-title", "夜宵");
    await advance(1000);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    await click("完成");
    expect(rpc.updatePocket).toHaveBeenCalledExactlyOnceWith(
      {
        pocketId: "12",
        expectedRevision: "3",
        title: "夜宵",
        requestId: expect.any(String),
      },
      {},
    );
    await advance(699);
    expect(rpc.updatePocket).toHaveBeenCalledOnce();
    await advance(1);
    expect(rpc.updatePocket).toHaveBeenNthCalledWith(
      2,
      {
        pocketId: "12",
        expectedRevision: "4",
        totalCents: 7555,
        requestId: expect.any(String),
      },
      {},
    );
    expect(container.querySelector("h1")?.textContent).toBe("夜宵");
    expect(amount.value).toBe("75.55");
  });

  it("checks a lost amount response and unlocks without submitting the amount again", async () => {
    await mountDraft();
    rpc.updatePocket.mockImplementationOnce(async () => {
      detail = {
        ...detail,
        pocket: { ...detail.pocket, totalCents: 7555, revision: "4" },
      };
      throw new Error("response lost");
    });
    const input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(700);
    await advance(2000);
    expect(rpc.updatePocket).toHaveBeenCalledOnce();
    expect(input.value).toBe("75.55");
    expect(button("选择分摊人").disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps name input after a conflict and retries without sending or overwriting the amount", async () => {
    await mountDraft();
    rpc.updatePocket.mockImplementationOnce(async () => {
      detail = {
        ...detail,
        pocket: { ...detail.pocket, title: "其他名称", revision: "8" },
      };
      throw new Error("版本冲突");
    });
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="修改聚餐名称"]')!
        .click(),
    );
    const input = await inputValue("draft-title", "周五晚饭");
    await click("完成");
    expect(input.value).toBe("周五晚饭");
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await click("完成");
    expect(rpc.updatePocket.mock.calls[1]?.[0]).toEqual({
      pocketId: "12",
      expectedRevision: "8",
      title: "周五晚饭",
      requestId: expect.any(String),
    });
    expect(detail.pocket.totalCents).toBe(10000);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not refresh an old Pocket after its save rejects on a different route", async () => {
    await mountDraft();
    let reject!: (error: Error) => void;
    rpc.updatePocket.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(700);
    detail = {
      ...detail,
      pocket: {
        ...detail.pocket,
        id: "99",
        totalCents: 2000,
        title: "另一个 Pocket",
      },
    };
    await act(async () => root.render(<PocketDetailPage pocketId="99" />));
    await act(async () => reject(new Error("response lost")));
    expect(container.querySelector("h1")?.textContent).toBe("另一个 Pocket");
    expect(
      container.querySelector<HTMLInputElement>("#draft-amount")?.value,
    ).toBe("20.00");
    expect(rpc.getPocket.mock.calls.map((call) => call[0])).toEqual([
      "12",
      "99",
    ]);
  });

  it("pauses scheduled amount writes while cancellation is open and does not write after cancelling", async () => {
    await mountDraft();
    const input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(300);
    await click("取消");
    await advance(1000);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    await click("确认取消");
    await advance(1000);
    expect(rpc.cancelPocket).toHaveBeenCalledOnce();
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    expect(container.querySelector("#draft-amount")).toBeNull();
  });

  it("clears scheduled writes on unmount and ignores old write results after route changes", async () => {
    await mountDraft();
    let input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(300);
    await act(async () => root.render(<div>离开编辑页</div>));
    await advance(1000);
    expect(rpc.updatePocket).not.toHaveBeenCalled();
    await mountDraft();
    let finish!: (pocket: PocketDetail["pocket"]) => void;
    rpc.updatePocket.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    input = await inputValue("draft-amount", "75.55");
    await act(async () => input.blur());
    await advance(700);
    expect(input.disabled).toBe(true);
    const previous = { ...detail.pocket, totalCents: 7555, revision: "4" };
    detail = {
      ...detail,
      pocket: {
        ...detail.pocket,
        id: "99",
        totalCents: 2000,
        title: "另一个 Pocket",
      },
    };
    await act(async () => root.render(<PocketDetailPage pocketId="99" />));
    await act(async () => finish(previous));
    expect(container.querySelector("h1")?.textContent).toBe("另一个 Pocket");
    expect(
      container.querySelector<HTMLInputElement>("#draft-amount")?.value,
    ).toBe("20.00");
    expect(rpc.getPocket.mock.calls.map((call) => call[0])).toEqual([
      "12",
      "12",
      "99",
    ]);
  });
});

describe("Pocket payment drawers", () => {
  it("ignores a payment response after leaving the activity", async () => {
    const onChanged = vi.fn();
    let finish!: (value: typeof bill) => void;
    rpc.payBill.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    bill.status = "unpaid";
    await act(async () =>
      root.render(<PocketPaymentSection pocketId="12" onChanged={onChanged} />),
    );
    await click("去付款");
    await click("我已支付 · ¥33.33");
    expect(rpc.payBill).toHaveBeenCalledOnce();
    await act(async () => root.render(<div>离开活动</div>));
    await act(async () => finish({ ...bill, status: "submitted" }));
    expect(rpc.getPocketPayment).toHaveBeenCalledOnce();
    expect(onChanged).not.toHaveBeenCalled();
    expect(container.textContent).toBe("离开活动");
  });

  it("requires the agreement before reporting payment through the shared dialog", async () => {
    await mount("payer");
    expect(
      dialog()
        .querySelector("dl")
        ?.textContent?.match(/¥33\.33/g),
    ).toHaveLength(1);
    expect(
      dialog().querySelector("dl")?.textContent?.match(/1234/g),
    ).toHaveLength(1);
    expect(button("我已支付 · ¥33.33").disabled).toBe(false);
    expect(rpc.payBill).not.toHaveBeenCalled();
    rpc.ensureAgreement.mockResolvedValue(false);
    await click("我已支付 · ¥33.33");
    expect(rpc.ensureAgreement).toHaveBeenCalledOnce();
    expect(rpc.payBill).not.toHaveBeenCalled();
    expect(button("我已支付 · ¥33.33").disabled).toBe(false);
  });

  it("locks duplicate reports and keeps the payment drawer blocked until a lost response is checked", async () => {
    let loseResponse!: () => void;
    rpc.payBill.mockImplementation(
      () =>
        new Promise((_, reject) => {
          loseResponse = () => reject(new Error("response lost"));
        }),
    );
    await mount("payer");
    await act(async () => {
      button("我已支付 · ¥33.33").click();
      button("我已支付 · ¥33.33").click();
    });
    expect(rpc.payBill).toHaveBeenCalledOnce();
    expect(rpc.payBill).toHaveBeenCalledWith(
      { billId: "20", updatedAt: bill.updatedAt, channel: "wechat" },
      {},
    );
    expect(button("提交中", dialog()).disabled).toBe(true);
    expect(button("稍后支付", dialog()).disabled).toBe(true);
    rpc.getPocketPayment.mockRejectedValue(new Error("unable to verify"));
    await act(async () => loseResponse());
    expect(dialog().textContent).toContain("支付账单加载失败");
    expect(dialog().querySelector('[role="checkbox"]')).toBeNull();
    expect(dialog().textContent).not.toContain("我已支付");
    bill.status = "submitted";
    rpc.getPocketPayment.mockImplementation(async () => ({
      pocket: { ...detail.pocket, isOwner: false },
      bill: { ...bill },
      payee: owner,
      qrContent: "wxp://published-snapshot",
      isOwner: false,
    }));
    await click("重新加载", dialog());
    expect(dialog().textContent).toContain("已提交支付确认");
    expect(dialog().textContent).not.toContain("我已支付");
    expect(rpc.payBill).toHaveBeenCalledOnce();
  });

  it("resets consent when switching to return and preserves the no-refund safeguard", async () => {
    await mount("owner");
    expect(dialog().textContent?.match(/¥33\.33/g)).toHaveLength(1);
    expect(button("确认已到账").disabled).toBe(true);
    expect(
      dialog().querySelector("footer")?.querySelectorAll("button"),
    ).toHaveLength(1);
    await act(async () => consent().click());
    expect(button("确认已到账").disabled).toBe(false);
    await click("未收到，退回待付");
    expect(consent().getAttribute("aria-checked")).toBe("false");
    expect(button("确认未到账，退回待付").disabled).toBe(true);
    expect(dialog().textContent).toContain("不会退款或撤销转账");
    await act(async () => consent().click());
    await click("确认未到账，退回待付");
    expect(rpc.rejectPocketPayment).toHaveBeenCalledExactlyOnceWith(
      { billId: "20", updatedAt: bill.updatedAt },
      {},
    );
    expect(rpc.confirmBill).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps confirmation and mode switching locked until a lost receipt response is verified", async () => {
    let loseResponse!: () => void;
    rpc.confirmBill.mockImplementation(
      () =>
        new Promise((_, reject) => {
          loseResponse = () => {
            bill.status = "completed";
            reject(new Error("response lost"));
          };
        }),
    );
    await mount("owner");
    await act(async () => consent().click());
    await act(async () => {
      button("确认已到账").click();
      button("确认已到账").click();
    });
    expect(rpc.confirmBill).toHaveBeenCalledOnce();
    expect(consent().disabled).toBe(true);
    expect(button("未收到，退回待付").disabled).toBe(true);
    rpc.getBill.mockRejectedValue(new Error("unable to verify"));
    await act(async () => loseResponse());
    expect(button("确认已到账").disabled).toBe(true);
    expect(button("未收到，退回待付").disabled).toBe(true);
    rpc.getBill.mockImplementation(async () => ({ ...bill }));
    await click("重新加载", dialog());
    expect(button("确认已到账").disabled).toBe(true);
    expect(consent().disabled).toBe(true);
    expect(rpc.confirmBill).toHaveBeenCalledOnce();
    expect(rpc.rejectPocketPayment).not.toHaveBeenCalled();
  });

  it("does not confirm receipt when the agreement is refused", async () => {
    rpc.ensureAgreement.mockResolvedValue(false);
    await mount("owner");
    await act(async () => consent().click());
    await click("确认已到账");
    expect(rpc.ensureAgreement).toHaveBeenCalledOnce();
    expect(rpc.confirmBill).not.toHaveBeenCalled();
    expect(rpc.rejectPocketPayment).not.toHaveBeenCalled();
  });
});
