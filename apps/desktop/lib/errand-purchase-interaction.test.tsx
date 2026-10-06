// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CollectingPaymentDetail,
  DistributingTaskDetail,
  ShoppingTaskDetail,
} from "@sast-shop/api";
import { CollectingPaymentView } from "../components/errand-purchase/collecting-payment-view";
import { DistributingTaskView } from "../components/errand-purchase/distributing-task-view";
import { ShoppingTaskView } from "../components/errand-purchase/shopping-task-view";

const {
  cancelTask,
  confirmBill,
  ensureAgreement,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail,
  refresh,
  saveDistributingAssignment,
  saveShoppingTaskItem,
  transitionToCollectingPayment,
  transitionToCompleted,
  transitionToDistributing,
  transitionToPendingDistributing,
  updateActualPrice,
} = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  confirmBill: vi.fn(),
  ensureAgreement: vi.fn(),
  getDistributingTaskDetail: vi.fn(),
  getErrandTaskBrief: vi.fn(),
  getShoppingTaskDetail: vi.fn(),
  refresh: vi.fn(),
  saveDistributingAssignment: vi.fn(),
  saveShoppingTaskItem: vi.fn(),
  transitionToCollectingPayment: vi.fn(),
  transitionToCompleted: vi.fn(),
  transitionToDistributing: vi.fn(),
  transitionToPendingDistributing: vi.fn(),
  updateActualPrice: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  cancelTask,
  confirmBill,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  getShoppingTaskDetail,
  saveDistributingAssignment,
  saveShoppingTaskItem,
  transitionToCollectingPayment,
  transitionToCompleted,
  transitionToDistributing,
  transitionToPendingDistributing,
  updateActualPrice,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));
vi.mock("@workspace/ui/components/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: React.ReactNode;
    }) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent: Wrapper,
    DialogDescription: Wrapper,
    DialogFooter: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
  };
});

const oldVersion = "2026-10-05T08:00:00.000000001Z";
const newVersion = "2026-10-05T08:00:00.000000002Z";

function shoppingDetail(): ShoppingTaskDetail {
  return {
    taskId: "7001",
    storeId: "3001",
    storeName: "SAST 小卖部",
    taskUpdatedAt: oldVersion,
    taskItems: [
      {
        id: "7101",
        productTitle: "矿泉水",
        productDescription: "",
        productImageUrl: "",
        productBarcode: "690000000001",
        requiredQuantity: 2,
        purchasedQuantity: null,
        nonPurchaseReason: null,
        actualUnitPriceCents: null,
        updatedAt: oldVersion,
        deadline: null,
      },
    ],
  };
}

function distributingDetail(): DistributingTaskDetail {
  return {
    taskId: "7002",
    storeId: "3001",
    storeName: "SAST 小卖部",
    taskUpdatedAt: oldVersion,
    packagingFeeCents: 0,
    items: [
      {
        errandTaskItemId: "7201",
        title: "矿泉水",
        description: "",
        imageUrl: "",
        originUnitPriceCents: 200,
        actualUnitPriceCents: 200,
        purchasedQuantity: 2,
        itemUpdatedAt: oldVersion,
        requesters: [
          {
            purchaserId: "1001",
            purchaserName: "小李",
            purchaserAvatarUrl: "",
            quantity: 2,
            distributedQuantity: 2,
            errandTaskAssignmentId: "8201",
            errandDemandItemId: "6101",
            assignmentUpdatedAt: oldVersion,
          },
          {
            purchaserId: "1002",
            purchaserName: "小王",
            purchaserAvatarUrl: "",
            quantity: 1,
            distributedQuantity: null,
            errandTaskAssignmentId: "8202",
            errandDemandItemId: "6102",
            assignmentUpdatedAt: oldVersion,
          },
        ],
      },
    ],
  };
}

function collectingDetail(): CollectingPaymentDetail {
  return {
    taskId: "7003",
    taskUpdatedAt: oldVersion,
    bills: [
      {
        requesterId: "1001",
        requesterName: "小李",
        requesterAvatarUrl: "",
        paymentStatus: "pending_confirmation",
        billId: "9101",
        billNo: "BILL-9101",
        billUpdatedAt: oldVersion,
        paymentChannel: "wechat",
        serialNumber: "202610050001",
        verifyCode: "2718",
        items: [],
        productAmountCents: 200,
        serviceFeeAmountCents: 0,
        packagingFeeShareCents: 0,
        totalAmountCents: 200,
      },
    ],
  };
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const mock of [
    cancelTask,
    confirmBill,
    ensureAgreement,
    getDistributingTaskDetail,
    getErrandTaskBrief,
    getShoppingTaskDetail,
    refresh,
    saveDistributingAssignment,
    saveShoppingTaskItem,
    transitionToCollectingPayment,
    transitionToCompleted,
    transitionToDistributing,
    transitionToPendingDistributing,
    updateActualPrice,
  ])
    mock.mockReset();
  ensureAgreement.mockResolvedValue(true);
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

function button(label: string, last = false): HTMLButtonElement {
  const matches = Array.from(container.querySelectorAll("button")).filter(
    (candidate) =>
      candidate.getAttribute("aria-label") === label ||
      candidate.textContent?.trim() === label,
  );
  const element = last ? matches.at(-1) : matches[0];
  expect(element, `Missing button: ${label}`).toBeDefined();
  return element!;
}

async function click(label: string, last = false) {
  await act(async () => button(label, last).click());
}

describe("desktop errand purchase interactions", () => {
  it("records all with one checkbox and directly edits a recorded quantity", async () => {
    const first = shoppingDetail();
    saveShoppingTaskItem.mockResolvedValue({ itemUpdatedAt: newVersion });
    getShoppingTaskDetail.mockResolvedValue({
      ...first,
      taskUpdatedAt: newVersion,
      taskItems: [
        { ...first.taskItems[0]!, purchasedQuantity: 2, updatedAt: newVersion },
      ],
    });
    await render(
      <ShoppingTaskView
        dataSource="local"
        detail={first}
        taskUpdatedAt={oldVersion}
      />,
    );
    await click("将矿泉水记为全部购买");
    expect(saveShoppingTaskItem).toHaveBeenCalledWith(
      expect.objectContaining({
        purchasedQuantity: 2,
        itemUpdatedAt: oldVersion,
      }),
      expect.anything(),
    );
    await click("修改矿泉水的采购结果");
    expect(container.textContent).toContain("记录采购");
    expect(
      (container.querySelector("#purchase-quantity") as HTMLInputElement).value,
    ).toBe("2");
    const quantityInput =
      container.querySelector<HTMLInputElement>("#purchase-quantity")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(quantityInput, "0");
      quantityInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("不购买原因（可选）");
    await click("保存采购结果");
    expect(saveShoppingTaskItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        purchasedQuantity: 0,
        itemUpdatedAt: newVersion,
      }),
      expect.anything(),
    );
  });

  it("locks shopping writes after an ambiguous response until fresh detail arrives", async () => {
    const first = shoppingDetail();
    saveShoppingTaskItem.mockRejectedValueOnce(new Error("网络中断"));
    await render(
      <ShoppingTaskView
        dataSource="local"
        detail={first}
        taskUpdatedAt={oldVersion}
      />,
    );
    await click("将矿泉水记为全部购买");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(button("将矿泉水记为全部购买").disabled).toBe(true);
    expect(button("取消采购任务").disabled).toBe(true);
    await render(
      <ShoppingTaskView
        dataSource="local"
        detail={{ ...first, taskItems: [...first.taskItems] }}
        taskUpdatedAt={oldVersion}
      />,
    );
    expect(button("将矿泉水记为全部购买").disabled).toBe(false);
  });

  it("also verifies a mock Connect save against a fresh detail version", async () => {
    const first = shoppingDetail();
    saveShoppingTaskItem.mockResolvedValue({ itemUpdatedAt: newVersion });
    getShoppingTaskDetail.mockResolvedValue(first);
    await render(
      <ShoppingTaskView
        dataSource="mock"
        detail={first}
        taskUpdatedAt={oldVersion}
      />,
    );
    await click("将矿泉水记为全部购买");
    expect(getShoppingTaskDetail).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(button("将矿泉水恢复为待采购").disabled).toBe(true);
  });

  it("requires every buyer result before completing distribution", async () => {
    const baseDetail = distributingDetail();
    const detail = {
      ...baseDetail,
      items: [
        {
          ...baseDetail.items[0]!,
          originUnitPriceCents: 1200,
          actualUnitPriceCents: 1100,
        },
      ],
    };
    await render(
      <DistributingTaskView
        dataSource="local"
        detail={detail}
        mode="distributing"
      />,
    );
    expect(container.textContent).toContain("实际 ¥11/件");
    expect(container.textContent).not.toContain("参考价 ¥12");
    expect(button("完成分发并生成账单").disabled).toBe(true);
    await render(
      <DistributingTaskView
        dataSource="local"
        detail={{
          ...detail,
          taskUpdatedAt: newVersion,
          items: [
            {
              ...detail.items[0]!,
              itemUpdatedAt: newVersion,
              requesters: [
                detail.items[0]!.requesters[0]!,
                {
                  ...detail.items[0]!.requesters[1]!,
                  distributedQuantity: 0,
                  assignmentUpdatedAt: newVersion,
                },
              ],
            },
          ],
        }}
        mode="distributing"
      />,
    );
    expect(button("完成分发并生成账单").disabled).toBe(false);
  });

  it("does not require an actual price for a product that was not purchased", async () => {
    const initial = distributingDetail();
    await render(
      <DistributingTaskView
        dataSource="local"
        detail={{
          ...initial,
          items: [
            {
              ...initial.items[0]!,
              purchasedQuantity: 0,
              actualUnitPriceCents: null,
            },
          ],
        }}
        mode="pending_distributing"
      />,
    );
    expect(button("确认价格并开始分发").disabled).toBe(false);
  });

  it("serializes assignment writes from two buyer rows in the same turn", async () => {
    const initial = distributingDetail();
    const item = initial.items[0]!;
    const detail = {
      ...initial,
      items: [
        {
          ...item,
          requesters: item.requesters.map((requester) => ({
            ...requester,
            quantity: 2,
            distributedQuantity: null,
          })),
        },
      ],
    };
    let finishSave: (value: { assignmentUpdatedAt: string }) => void = () => {};
    saveDistributingAssignment.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    );
    getDistributingTaskDetail.mockResolvedValue(detail);
    await render(
      <DistributingTaskView
        dataSource="local"
        detail={detail}
        mode="distributing"
      />,
    );
    await click("展开");
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    );
    expect(inputs).toHaveLength(2);
    await act(async () => {
      for (const input of inputs) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, "2");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const saveButtons = Array.from(container.querySelectorAll("button")).filter(
      (candidate) => candidate.textContent?.trim() === "保存",
    );
    expect(saveButtons).toHaveLength(2);
    await act(async () => {
      saveButtons[0]!.click();
      saveButtons[1]!.click();
    });
    expect(saveDistributingAssignment).toHaveBeenCalledTimes(1);
    await act(async () => finishSave({ assignmentUpdatedAt: newVersion }));
  });

  it("locks a bill after an ambiguous confirmation and accepts a newer bill version", async () => {
    const first = collectingDetail();
    confirmBill.mockRejectedValueOnce(new Error("网络中断"));
    await render(
      <CollectingPaymentView
        dataSource="local"
        detail={first}
        taskId="7003"
        taskUpdatedAt={oldVersion}
      />,
    );
    await click("确认收款");
    await click("确认收款", true);
    expect(confirmBill).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(button("确认收款").disabled).toBe(true);
    await render(
      <CollectingPaymentView
        dataSource="local"
        detail={{
          ...first,
          taskUpdatedAt: newVersion,
          bills: [{ ...first.bills[0]!, billUpdatedAt: newVersion }],
        }}
        taskId="7003"
        taskUpdatedAt={newVersion}
      />,
    );
    expect(button("确认收款").disabled).toBe(false);
  });
});
