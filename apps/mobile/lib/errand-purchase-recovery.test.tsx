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
  transitionToCompleted,
  transitionToCollectingPayment,
  transitionToDistributing,
  transitionToPendingDistributing,
  updateActualPrice,
  refresh,
} = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  confirmBill: vi.fn(),
  getDistributingTaskDetail: vi.fn(),
  getErrandTaskBrief: vi.fn(),
  transitionToCompleted: vi.fn(),
  transitionToCollectingPayment: vi.fn(),
  transitionToDistributing: vi.fn(),
  transitionToPendingDistributing: vi.fn(),
  updateActualPrice: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@sast-shop/api", () => ({
  cancelTask,
  confirmBill,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail: vi.fn(),
  saveDistributingAssignment: vi.fn(),
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
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  refresh.mockReset();
  cancelTask.mockReset();
  confirmBill.mockReset();
  getDistributingTaskDetail.mockReset();
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

describe("errand purchase refresh recovery", () => {
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
