// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CollectingPaymentBill,
  CollectingPaymentDetail,
  DistributingTaskDetail,
  ShoppingTaskDetail,
} from "@sast-shop/api";
import {
  MobileHeaderActionsProvider,
  MobileHeaderActionSlot,
} from "../components/mobile-header-actions";
import { CollectingPaymentView } from "../components/errand-purchase/collecting-payment-view";
import { DistributingTaskView } from "../components/errand-purchase/distributing-task-view";
import { ShoppingTaskView } from "../components/errand-purchase/shopping-task-view";

const {
  cancelTask,
  confirmBill,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  saveDistributingAssignment,
  transitionToCompleted,
  transitionToCollectingPayment,
  transitionToDistributing,
  transitionToPendingDistributing,
  updateActualPrice,
  refresh,
  ensureAgreement,
  push,
  replace,
  waitForDrawerHistoryCleanup,
} = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  confirmBill: vi.fn(),
  getDistributingTaskDetail: vi.fn(),
  getErrandTaskBrief: vi.fn(),
  saveDistributingAssignment: vi.fn(),
  transitionToCompleted: vi.fn(),
  transitionToCollectingPayment: vi.fn(),
  transitionToDistributing: vi.fn(),
  transitionToPendingDistributing: vi.fn(),
  updateActualPrice: vi.fn(),
  refresh: vi.fn(),
  ensureAgreement: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  waitForDrawerHistoryCleanup: vi.fn(),
}));

vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace, push }),
}));
vi.mock("@workspace/ui/lib/drawer-history", () => ({
  waitForDrawerHistoryCleanup,
}));
vi.mock("@sast-shop/api", () => ({
  cancelTask,
  confirmBill,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail: vi.fn(),
  saveDistributingAssignment,
  saveShoppingTaskItem: vi.fn(),
  transitionToCollectingPayment,
  transitionToCompleted,
  transitionToDistributing,
  transitionToPendingDistributing,
  updateActualPrice,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <div aria-label={alt} />,
}));
vi.mock("../components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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

const shoppingDetail: ShoppingTaskDetail = {
  taskId: "7001",
  storeId: "3001",
  storeName: "SAST 小卖部",
  taskUpdatedAt: "2026-07-18T02:00:00Z",
  taskItems: [
    {
      id: "7101",
      productTitle: "矿泉水",
      productDescription: "550ml",
      productImageUrl: "",
      productBarcode: "690000000001",
      requiredQuantity: 1,
      purchasedQuantity: 1,
      nonPurchaseReason: null,
      actualUnitPriceCents: null,
      updatedAt: "2026-07-18T02:00:00Z",
      deadline: null,
    },
  ],
};
const distributingDetail: DistributingTaskDetail = {
  taskId: "7002",
  storeId: "3001",
  storeName: "SAST 小卖部",
  taskUpdatedAt: "2026-07-18T02:00:00Z",
  packagingFeeCents: 0,
  items: [
    {
      errandTaskItemId: "7201",
      title: "矿泉水",
      description: "550ml",
      imageUrl: "",
      originUnitPriceCents: 200,
      actualUnitPriceCents: 200,
      purchasedQuantity: 1,
      itemUpdatedAt: "2026-07-18T02:00:00Z",
      requesters: [
        {
          purchaserId: "1001",
          purchaserName: "李同学",
          purchaserAvatarUrl: "",
          quantity: 1,
          distributedQuantity: null,
          errandTaskAssignmentId: "8201",
          errandDemandItemId: "6101",
          assignmentUpdatedAt: "2026-07-18T02:00:00Z",
        },
      ],
    },
  ],
};
const bill: CollectingPaymentBill = {
  requesterId: "1001",
  requesterName: "李同学",
  requesterAvatarUrl: "",
  paymentStatus: "confirmed",
  billId: "9101",
  billNo: "BILL-9101",
  billUpdatedAt: "2026-07-18T02:00:00Z",
  paymentChannel: "wechat",
  serialNumber: null,
  verifyCode: "2718",
  items: [],
  productAmountCents: 200,
  serviceFeeAmountCents: 0,
  packagingFeeShareCents: 0,
  totalAmountCents: 200,
};
const collectingDetail: CollectingPaymentDetail = {
  taskId: "7004",
  taskUpdatedAt: "2026-07-18T02:00:00Z",
  bills: [bill],
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  waitForDrawerHistoryCleanup.mockReset().mockResolvedValue(undefined);
  ensureAgreement.mockReset();
  ensureAgreement.mockResolvedValue(true);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  refresh.mockReset();
  cancelTask.mockReset();
  confirmBill.mockReset();
  getDistributingTaskDetail.mockReset();
  saveDistributingAssignment.mockReset();
  transitionToPendingDistributing.mockReset();
  updateActualPrice.mockReset();
  transitionToDistributing.mockReset();
  transitionToCompleted.mockReset();
  transitionToCollectingPayment.mockReset();
  getErrandTaskBrief.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(element: React.ReactNode) {
  await act(async () => root.render(element));
}

async function click(label: string, last = false) {
  const button = getButton(label, last);
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

function getButton(label: string, last = false) {
  const buttons = Array.from(container.querySelectorAll("button")).filter(
    (button) => button.textContent?.trim() === label,
  );
  return last ? buttons.at(-1) : buttons[0];
}

function getAction(label: string) {
  return container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
}

async function expandDistributionItem() {
  const toggle = container.querySelector<HTMLButtonElement>(
    '[aria-controls="distributing-item-7201"]',
  );
  expect(toggle).not.toBeNull();
  await act(async () => toggle!.click());
}

function distributionView(
  detail: DistributingTaskDetail = distributingDetail,
  mode: "pending_distributing" | "distributing" = "distributing",
) {
  return (
    <DistributingTaskView
      dataSource="mock"
      connectBaseUrl="http://127.0.0.1:6660"
      detail={detail}
      mode={mode}
    />
  );
}

describe("errand purchase refresh recovery", () => {
  it("waits for drawer history after cancelling a shopping task before navigating", async () => {
    let finishCleanup!: () => void;
    waitForDrawerHistoryCleanup.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
    );
    cancelTask.mockResolvedValue(undefined);
    await render(
      <MobileHeaderActionsProvider>
        <header>
          <MobileHeaderActionSlot />
        </header>
        <ShoppingTaskView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1327"
          detail={shoppingDetail}
          taskUpdatedAt={shoppingDetail.taskUpdatedAt}
        />
      </MobileHeaderActionsProvider>,
    );
    await act(async () =>
      (container.querySelector("header button") as HTMLButtonElement).click(),
    );
    await click("确认取消");
    expect(waitForDrawerHistoryCleanup).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(cancelTask).toHaveBeenCalledTimes(1);
    await act(async () => finishCleanup());
    expect(push).toHaveBeenCalledWith("/group");
  });

  it("waits for drawer history after finishing distribution before opening payment", async () => {
    let finishCleanup!: () => void;
    waitForDrawerHistoryCleanup.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
    );
    transitionToCollectingPayment.mockResolvedValue(undefined);
    const item = distributingDetail.items[0]!;
    await render(
      distributionView({
        ...distributingDetail,
        items: [
          {
            ...item,
            requesters: [{ ...item.requesters[0]!, distributedQuantity: 1 }],
          },
        ],
      }),
    );
    await click("确认分发完成");
    await click("确认完成");
    expect(waitForDrawerHistoryCleanup).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(transitionToCollectingPayment).toHaveBeenCalledTimes(1);
    await act(async () => finishCleanup());
    expect(replace).toHaveBeenCalledWith("/group/purchase/7002/payment");
  });

  it.each(["completed", "collecting_payment"])(
    "waits for drawer history before leaving a completed order from %s",
    async (status) => {
      let finishCleanup!: () => void;
      waitForDrawerHistoryCleanup.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishCleanup = resolve;
        }),
      );
      getErrandTaskBrief.mockResolvedValue({
        id: "7004",
        status,
        updatedAt: "2026-07-18T02:00:00Z",
      });
      transitionToCompleted.mockResolvedValue(undefined);
      await render(
        <CollectingPaymentView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1327"
          detail={collectingDetail}
          taskId="7004"
          taskUpdatedAt={collectingDetail.taskUpdatedAt}
        />,
      );
      await click("订单完成");
      await click("订单完成", true);
      expect(waitForDrawerHistoryCleanup).toHaveBeenCalledTimes(1);
      expect(replace).not.toHaveBeenCalled();
      await act(async () => finishCleanup());
      expect(replace).toHaveBeenCalledWith("/orders?type=errand&view=captain");
    },
  );
  it("does not finish or cancel a shopping task after agreement refusal", async () => {
    ensureAgreement.mockImplementation(async (beforePrompt?: () => void) => {
      beforePrompt?.();
      return false;
    });
    await render(
      <MobileHeaderActionsProvider>
        <header>
          <MobileHeaderActionSlot />
        </header>
        <ShoppingTaskView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1327"
          detail={shoppingDetail}
          taskUpdatedAt={shoppingDetail.taskUpdatedAt}
        />
      </MobileHeaderActionsProvider>,
    );

    await click("确认完成采购");
    await click("完成采购");
    expect(transitionToPendingDistributing).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("完成采购后将进入分发");

    const cancelAction =
      container.querySelector<HTMLButtonElement>("header button");
    expect(cancelAction?.textContent).toContain("取消采购");
    await act(async () => cancelAction!.click());
    expect(cancelTask).not.toHaveBeenCalled();
    await click("确认取消");

    expect(ensureAgreement).toHaveBeenCalledTimes(2);
    expect(cancelTask).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("确认取消此次采购任务");
  });

  it("does not cancel a distributing task after agreement refusal", async () => {
    ensureAgreement.mockImplementation(async (beforePrompt?: () => void) => {
      beforePrompt?.();
      return false;
    });
    await render(
      <MobileHeaderActionsProvider>
        <header>
          <MobileHeaderActionSlot />
        </header>
        <DistributingTaskView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1327"
          detail={distributingDetail}
          mode="pending_distributing"
        />
      </MobileHeaderActionsProvider>,
    );

    const cancelAction =
      container.querySelector<HTMLButtonElement>("header button");
    expect(cancelAction?.textContent).toContain("取消采购");
    await act(async () => cancelAction!.click());
    expect(cancelTask).not.toHaveBeenCalled();
    await click("确认取消");

    expect(ensureAgreement).toHaveBeenCalledTimes(1);
    expect(cancelTask).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("确认取消此次采购任务");
  });

  it("does not confirm a bill when the transaction agreement is declined", async () => {
    ensureAgreement.mockResolvedValue(false);
    await render(
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...collectingDetail,
          bills: [{ ...bill, paymentStatus: "pending_confirmation" }],
        }}
        taskId="7004"
        taskUpdatedAt={collectingDetail.taskUpdatedAt}
      />,
    );
    const billToggle = container.querySelector<HTMLButtonElement>(
      '[aria-controls="payment-bill-9101"]',
    );
    await act(async () => billToggle!.click());
    await click("确认收款");
    await click("确认收款", true);

    expect(ensureAgreement).toHaveBeenCalledTimes(1);
    expect(confirmBill).not.toHaveBeenCalled();
  });

  it.each([
    ["pending_confirmation", "wechat", "微信支付"],
    ["pending_confirmation", "alipay", "支付宝"],
    ["pending_confirmation", null, "未提供"],
    ["confirmed", "wechat", "微信支付"],
    ["confirmed", "alipay", "支付宝"],
    ["confirmed", null, "未提供"],
  ] as const)(
    "shows %s bill payment channel %s as %s in the expanded detail",
    async (paymentStatus, paymentChannel, expectedLabel) => {
      await render(
        <CollectingPaymentView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1327"
          detail={{
            ...collectingDetail,
            bills: [{ ...bill, paymentStatus, paymentChannel }],
          }}
          taskId="7004"
          taskUpdatedAt={collectingDetail.taskUpdatedAt}
        />,
      );
      const billToggle = container.querySelector<HTMLButtonElement>(
        '[aria-controls="payment-bill-9101"]',
      );
      await act(async () => billToggle!.click());

      const billDetail = container.querySelector("#payment-bill-9101");
      expect(billDetail?.textContent).toContain("支付平台");
      expect(billDetail?.textContent).toContain(expectedLabel);
    },
  );

  it("keeps price editing separate from requester expansion", async () => {
    getDistributingTaskDetail.mockResolvedValue(distributingDetail);
    const view = (mode: "pending_distributing" | "distributing") => (
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={distributingDetail}
        mode={mode}
      />
    );
    await render(view("pending_distributing"));

    const expandButton = container.querySelector<HTMLButtonElement>(
      '[aria-controls="distributing-item-7201"]',
    );
    const priceButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="修改矿泉水的单价"]',
    );
    expect(expandButton).not.toBeNull();
    expect(priceButton).not.toBeNull();
    expect(priceButton!.parentElement?.closest("button")).toBeNull();
    expect(expandButton!.getAttribute("aria-expanded")).toBe("false");

    await act(async () => priceButton!.click());
    expect(container.textContent).toContain("修改单价");
    expect(expandButton!.getAttribute("aria-expanded")).toBe("false");
    await click("取消");

    await act(async () => expandButton!.click());
    expect(expandButton!.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector("#distributing-item-7201")?.textContent,
    ).toContain("李同学");
    expect(
      container.querySelectorAll('[aria-label="修改矿泉水的单价"]'),
    ).toHaveLength(1);
    expect(
      container
        .querySelector("#distributing-item-7201")
        ?.querySelector('[aria-label="修改矿泉水的单价"]'),
    ).toBeNull();

    await act(async () => expandButton!.click());
    expect(expandButton!.getAttribute("aria-expanded")).toBe("false");

    await act(async () => priceButton!.click());
    expect(expandButton!.getAttribute("aria-expanded")).toBe("false");
    const priceInput = container.querySelector<HTMLInputElement>(
      "#distribution-unit-price",
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(priceInput, "3.00");
      priceInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("保存单价");
    expect(expandButton!.getAttribute("aria-expanded")).toBe("false");
    expect(updateActualPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        errandTaskId: "7002",
        errandTaskItemId: "7201",
        actualUnitPriceCents: 300,
        itemUpdatedAt: distributingDetail.items[0]!.itemUpdatedAt,
      }),
      expect.any(Object),
    );

    await render(view("distributing"));
    expect(
      container.querySelector('[aria-label="修改矿泉水的单价"]'),
    ).toBeNull();
  });

  it("keeps header cancellation behind confirmation and blocks retries until a newer task arrives", async () => {
    cancelTask.mockRejectedValue(new Error("网络中断"));
    const view = (detail: ShoppingTaskDetail) => (
      <MobileHeaderActionsProvider>
        <header>
          <MobileHeaderActionSlot />
        </header>
        <ShoppingTaskView
          dataSource="local"
          connectBaseUrl="http://127.0.0.1:1327"
          detail={detail}
          taskUpdatedAt={detail.taskUpdatedAt}
        />
      </MobileHeaderActionsProvider>
    );
    const headerAction = () =>
      container.querySelector("header button") as HTMLButtonElement | null;

    await render(view(shoppingDetail));
    expect(headerAction()?.textContent).toContain("取消采购");
    await act(async () => headerAction()!.click());
    expect(cancelTask).not.toHaveBeenCalled();
    expect(container.textContent).toContain("确认取消此次采购任务");
    await click("返回");
    expect(cancelTask).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("确认取消此次采购任务");

    await act(async () => headerAction()!.click());
    await click("确认取消");
    expect(cancelTask).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(headerAction()?.disabled).toBe(true);
    expect(container.textContent).not.toContain("确认取消此次采购任务");
    await act(async () => headerAction()!.click());
    expect(cancelTask).toHaveBeenCalledTimes(1);

    await render(
      view({
        ...shoppingDetail,
        taskUpdatedAt: "2026-07-18T02:00:01Z",
      }),
    );
    expect(headerAction()?.disabled).toBe(false);
  });

  it("refreshes shopping state after a failed completion transition", async () => {
    transitionToPendingDistributing.mockRejectedValue(new Error("版本冲突"));
    await render(
      <ShoppingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={shoppingDetail}
        taskUpdatedAt={shoppingDetail.taskUpdatedAt}
      />,
    );

    await click("确认完成采购");
    await click("完成采购");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getButton("确认完成采购")?.disabled).toBe(true);
    expect(container.textContent).not.toContain("完成采购后将进入分发");
    await click("确认完成采购");
    expect(transitionToPendingDistributing).toHaveBeenCalledTimes(1);

    await render(
      <ShoppingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...shoppingDetail,
          taskUpdatedAt: "2026-07-18T02:00:01Z",
        }}
        taskUpdatedAt="2026-07-18T02:00:01Z"
      />,
    );
    expect(getButton("确认完成采购")?.disabled).toBe(false);
  });

  it("uses refreshed shopping items after a failed transition", async () => {
    await render(
      <ShoppingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={shoppingDetail}
        taskUpdatedAt={shoppingDetail.taskUpdatedAt}
      />,
    );
    expect(container.textContent).toContain("矿泉水");

    await render(
      <ShoppingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...shoppingDetail,
          taskUpdatedAt: "2026-07-18T02:00:01Z",
          taskItems: [],
        }}
        taskUpdatedAt={shoppingDetail.taskUpdatedAt}
      />,
    );

    expect(container.textContent).not.toContain("矿泉水");
    await render(
      <ShoppingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={shoppingDetail}
        taskUpdatedAt={shoppingDetail.taskUpdatedAt}
      />,
    );
    expect(container.textContent).not.toContain("矿泉水");
  });

  it("does not restore an old shopping item after a newer nanosecond snapshot", async () => {
    const older = {
      ...shoppingDetail,
      taskItems: [
        {
          ...shoppingDetail.taskItems[0]!,
          purchasedQuantity: null,
          updatedAt: "2026-07-18T02:00:00.123000001Z",
        },
      ],
    };
    const newer = {
      ...shoppingDetail,
      taskItems: [
        {
          ...shoppingDetail.taskItems[0]!,
          purchasedQuantity: 1,
          updatedAt: "2026-07-18T02:00:00.123000002Z",
        },
      ],
    };
    const view = (detail: ShoppingTaskDetail) => (
      <ShoppingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={detail}
        taskUpdatedAt={detail.taskUpdatedAt}
      />
    );

    await render(view(older));
    await render(view(newer));
    await render(view(older));

    expect(container.textContent).toContain("已记录");
    expect(container.textContent).not.toContain("待采购");
  });

  it("refreshes distribution state after a failed start transition", async () => {
    transitionToDistributing.mockRejectedValue(new Error("版本冲突"));
    await render(
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={distributingDetail}
        mode="pending_distributing"
      />,
    );

    await click("确认开始分发");
    await click("确认开始");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getButton("确认开始分发")?.disabled).toBe(true);
    await click("确认开始分发");
    expect(transitionToDistributing).toHaveBeenCalledTimes(1);

    await render(
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...distributingDetail,
          taskUpdatedAt: "2026-07-18T02:00:01Z",
        }}
        mode="pending_distributing"
      />,
    );
    expect(getButton("确认开始分发")?.disabled).toBe(false);
  });

  it("uses new distribution items after a refresh of the same component", async () => {
    await render(
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={distributingDetail}
        mode="pending_distributing"
      />,
    );
    expect(container.textContent).toContain("矿泉水");

    await render(
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...distributingDetail,
          taskUpdatedAt: "2026-07-18T02:00:01Z",
          items: [],
        }}
        mode="pending_distributing"
      />,
    );

    expect(container.textContent).not.toContain("矿泉水");
    await render(
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={distributingDetail}
        mode="pending_distributing"
      />,
    );
    expect(container.textContent).not.toContain("矿泉水");
  });

  it("does not restore old assignment or price versions after a late snapshot", async () => {
    const oldItem = distributingDetail.items[0]!;
    const oldDetail: DistributingTaskDetail = {
      ...distributingDetail,
      items: [
        {
          ...oldItem,
          actualUnitPriceCents: 200,
          itemUpdatedAt: "2026-07-18T02:00:00.123000001Z",
          requesters: [
            {
              ...oldItem.requesters[0]!,
              distributedQuantity: null,
              assignmentUpdatedAt: "2026-07-18T02:00:00.123000001Z",
            },
          ],
        },
      ],
    };
    const freshDetail: DistributingTaskDetail = {
      ...oldDetail,
      items: [
        {
          ...oldDetail.items[0]!,
          actualUnitPriceCents: 300,
          itemUpdatedAt: "2026-07-18T02:00:00.123000002Z",
          requesters: [
            {
              ...oldDetail.items[0]!.requesters[0]!,
              distributedQuantity: 1,
              assignmentUpdatedAt: "2026-07-18T02:00:00.123000002Z",
            },
          ],
        },
      ],
    };
    const view = (detail: DistributingTaskDetail) => (
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={detail}
        mode="distributing"
      />
    );

    await render(view(oldDetail));
    await render(view(freshDetail));
    await render(view(oldDetail));

    expect(container.textContent).toContain("¥3");
    expect(container.textContent).toContain("已分发");
  });

  it("blocks another finish transition while its result remains unverified", async () => {
    transitionToCollectingPayment.mockRejectedValue(new Error("响应中断"));
    getErrandTaskBrief.mockResolvedValue({ status: "distributing" });
    const item = distributingDetail.items[0]!;
    await render(
      <DistributingTaskView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...distributingDetail,
          items: [
            {
              ...item,
              requesters: [{ ...item.requesters[0]!, distributedQuantity: 1 }],
            },
          ],
        }}
        mode="distributing"
      />,
    );

    await click("确认分发完成");
    await click("确认完成");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getButton("确认分发完成")?.disabled).toBe(true);
    expect(container.textContent).toContain("任务状态待核实");
    await click("确认分发完成");
    expect(transitionToCollectingPayment).toHaveBeenCalledTimes(1);
  });

  it("uses new bills after refreshing an initially empty payment page", async () => {
    await render(
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{ ...collectingDetail, bills: [] }}
        taskId="7004"
        taskUpdatedAt={collectingDetail.taskUpdatedAt}
      />,
    );
    expect(container.textContent).toContain("暂无账单");

    await render(
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={collectingDetail}
        taskId="7004"
        taskUpdatedAt={collectingDetail.taskUpdatedAt}
      />,
    );

    expect(container.textContent).toContain("1/1 人已收款");
    expect(container.textContent).not.toContain("暂无账单");
  });

  it("does not restore an old pending bill after confirming a newer version", async () => {
    const oldDetail: CollectingPaymentDetail = {
      ...collectingDetail,
      bills: [
        {
          ...bill,
          paymentStatus: "pending_confirmation",
          billUpdatedAt: "2026-07-18T02:00:00.123000001Z",
        },
      ],
    };
    const freshDetail: CollectingPaymentDetail = {
      ...collectingDetail,
      bills: [
        {
          ...bill,
          paymentStatus: "confirmed",
          billUpdatedAt: "2026-07-18T02:00:00.123000002Z",
        },
      ],
    };
    const view = (detail: CollectingPaymentDetail) => (
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={detail}
        taskId="7004"
        taskUpdatedAt={detail.taskUpdatedAt}
      />
    );

    await render(view(oldDetail));
    await render(view(freshDetail));
    await render(view(oldDetail));

    expect(container.textContent).toContain("1/1 人已收款");
    expect(container.textContent).not.toContain("0/1 人已收款");
  });

  it("refreshes bill state after a failed order completion", async () => {
    getErrandTaskBrief.mockResolvedValue({
      id: "7004",
      status: "collecting_payment",
      updatedAt: "2026-07-18T02:00:00Z",
    });
    transitionToCompleted.mockRejectedValue(new Error("版本冲突"));
    await render(
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={collectingDetail}
        taskId="7004"
        taskUpdatedAt={collectingDetail.taskUpdatedAt}
      />,
    );

    await click("订单完成");
    await click("订单完成", true);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getButton("订单完成")?.disabled).toBe(true);
    await click("订单完成");
    expect(transitionToCompleted).toHaveBeenCalledTimes(1);
  });

  it("refreshes a bill after an ambiguous confirmation failure", async () => {
    confirmBill.mockRejectedValue(new Error("网络中断"));
    await render(
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={{
          ...collectingDetail,
          bills: [{ ...bill, paymentStatus: "pending_confirmation" }],
        }}
        taskId="7004"
        taskUpdatedAt={collectingDetail.taskUpdatedAt}
      />,
    );

    const billToggle = container.querySelector(
      '[aria-controls="payment-bill-9101"]',
    );
    expect(billToggle).not.toBeNull();
    await act(async () => (billToggle as HTMLButtonElement).click());
    await click("确认收款");
    await click("确认收款", true);

    expect(confirmBill).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("确认这笔款项已到账？");
    expect(getButton("确认收款")?.disabled).toBe(true);
    await click("确认收款");
    expect(confirmBill).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful local bill confirmation across an old server snapshot", async () => {
    confirmBill.mockResolvedValue({ updatedAt: bill.billUpdatedAt });
    const pendingDetail: CollectingPaymentDetail = {
      ...collectingDetail,
      bills: [{ ...bill, paymentStatus: "pending_confirmation" }],
    };
    const view = (detail: CollectingPaymentDetail) => (
      <CollectingPaymentView
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        detail={detail}
        taskId="7004"
        taskUpdatedAt={detail.taskUpdatedAt}
      />
    );

    await render(view(pendingDetail));
    const billToggle = container.querySelector(
      '[aria-controls="payment-bill-9101"]',
    );
    await act(async () => (billToggle as HTMLButtonElement).click());
    await click("确认收款");
    await click("确认收款", true);
    await render(view({ ...pendingDetail, bills: [...pendingDetail.bills] }));

    expect(container.textContent).toContain("1/1 人已收款");
    expect(container.textContent).not.toContain("0/1 人已收款");
  });
});

describe("distribution requester actions", () => {
  it("records a full distribution and revokes it with the returned assignment version", async () => {
    saveDistributingAssignment
      .mockResolvedValueOnce({ assignmentUpdatedAt: "2026-07-18T02:00:01Z" })
      .mockResolvedValueOnce({ assignmentUpdatedAt: "2026-07-18T02:00:02Z" });
    await render(distributionView());
    await expandDistributionItem();

    const full = getAction("李同学全部分发");
    expect(full?.getAttribute("aria-checked")).toBe("false");
    await act(async () => full!.click());
    expect(saveDistributingAssignment).toHaveBeenNthCalledWith(
      1,
      {
        errandTaskItemId: "7201",
        errandTaskAssignmentId: "8201",
        distributedQuantity: 1,
        assignmentUpdatedAt: "2026-07-18T02:00:00Z",
      },
      expect.any(Object),
    );

    const revoke = getAction("李同学撤销分发结果");
    expect(revoke?.getAttribute("aria-checked")).toBe("true");
    await act(async () => revoke!.click());
    expect(saveDistributingAssignment).toHaveBeenNthCalledWith(
      2,
      {
        errandTaskItemId: "7201",
        errandTaskAssignmentId: "8201",
        distributedQuantity: -1,
        assignmentUpdatedAt: "2026-07-18T02:00:01Z",
      },
      expect.any(Object),
    );
    expect(getAction("李同学全部分发")?.getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("blocks full distribution without stock and limits the partial editor", async () => {
    const item = distributingDetail.items[0]!;
    await render(
      distributionView({
        ...distributingDetail,
        items: [
          {
            ...item,
            purchasedQuantity: 2,
            requesters: [{ ...item.requesters[0]!, quantity: 3 }],
          },
        ],
      }),
    );
    await expandDistributionItem();
    const full = getAction("李同学全部分发");
    expect(full?.disabled).toBe(true);
    await act(async () => full!.click());
    expect(saveDistributingAssignment).not.toHaveBeenCalled();

    const partial = getAction("李同学部分分发");
    expect(partial).not.toBeNull();
    await act(async () => partial!.click());
    const input = container.querySelector<HTMLInputElement>(
      "#partial-distribution-quantity",
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "3");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(getButton("记录分发数量")?.disabled).toBe(true);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    saveDistributingAssignment.mockResolvedValue({
      assignmentUpdatedAt: "2026-07-18T02:00:01Z",
    });
    await click("记录分发数量");
    expect(saveDistributingAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        distributedQuantity: 2,
        assignmentUpdatedAt: "2026-07-18T02:00:00Z",
      }),
      expect.any(Object),
    );
    expect(getAction("李同学撤销分发结果")?.getAttribute("aria-checked")).toBe(
      "mixed",
    );
  });

  it("records no distribution as indeterminate and revokes it with -1", async () => {
    saveDistributingAssignment
      .mockResolvedValueOnce({ assignmentUpdatedAt: "2026-07-18T02:00:01Z" })
      .mockResolvedValueOnce({ assignmentUpdatedAt: "2026-07-18T02:00:02Z" });
    await render(distributionView());
    await expandDistributionItem();
    await act(async () => getAction("李同学不分发")!.click());
    expect(saveDistributingAssignment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        distributedQuantity: 0,
        assignmentUpdatedAt: "2026-07-18T02:00:00Z",
      }),
      expect.any(Object),
    );
    const revoke = getAction("李同学撤销分发结果");
    expect(revoke?.getAttribute("aria-checked")).toBe("mixed");
    await act(async () => revoke!.click());
    expect(saveDistributingAssignment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        distributedQuantity: -1,
        assignmentUpdatedAt: "2026-07-18T02:00:01Z",
      }),
      expect.any(Object),
    );
  });

  it("hides requester actions before the distribution phase", async () => {
    await render(distributionView(distributingDetail, "pending_distributing"));
    await expandDistributionItem();
    expect(getAction("李同学全部分发")).toBeNull();
    expect(getAction("李同学部分分发")).toBeNull();
    expect(getAction("李同学不分发")).toBeNull();
    expect(saveDistributingAssignment).not.toHaveBeenCalled();
  });

  it("locks every requester action while saving and keeps the old state on failure", async () => {
    let rejectSave!: (error: Error) => void;
    saveDistributingAssignment.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      }),
    );
    await render(distributionView());
    await expandDistributionItem();
    await act(async () => getAction("李同学全部分发")!.click());
    expect(getAction("李同学全部分发")?.disabled).toBe(true);
    expect(getAction("李同学不分发")?.disabled).toBe(true);
    await act(async () => getAction("李同学不分发")!.click());
    expect(saveDistributingAssignment).toHaveBeenCalledTimes(1);

    await act(async () => rejectSave(new Error("响应中断")));
    expect(getAction("李同学全部分发")?.disabled).toBe(false);
    expect(getAction("李同学全部分发")?.getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(container.textContent).not.toContain("已分发 1 件");
  });
});
