// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShoppingTaskDetail, ShoppingTaskItem } from "@sast-shop/api";
import { ShoppingTaskView } from "../components/errand-purchase/shopping-task-view";

const { refresh, saveShoppingTaskItem } = vi.hoisted(() => ({
  refresh: vi.fn(),
  saveShoppingTaskItem: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("@sast-shop/api", () => ({
  cancelTask: vi.fn(),
  getShoppingTaskDetail: vi.fn(),
  saveShoppingTaskItem,
  transitionToPendingDistributing: vi.fn(),
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

const water: ShoppingTaskItem = {
  id: "7101",
  productTitle: "矿泉水",
  productDescription: "550ml",
  productImageUrl: "",
  productBarcode: "690000000001",
  requiredQuantity: 3,
  purchasedQuantity: null,
  nonPurchaseReason: null,
  actualUnitPriceCents: null,
  updatedAt: "2026-07-18T02:00:00Z",
  deadline: null,
};
const bread: ShoppingTaskItem = {
  ...water,
  id: "7102",
  productTitle: "面包",
  productBarcode: "690000000002",
  requiredQuantity: 2,
  purchasedQuantity: 1,
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  refresh.mockReset();
  saveShoppingTaskItem.mockReset();
  saveShoppingTaskItem.mockResolvedValue({
    itemUpdatedAt: "2026-07-18T02:00:01Z",
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(items: ShoppingTaskItem[]) {
  const detail: ShoppingTaskDetail = {
    taskId: "7001",
    storeId: "3001",
    storeName: "SAST 小卖部",
    taskUpdatedAt: "2026-07-18T02:00:00Z",
    taskItems: items,
  };
  await act(async () =>
    root.render(
      <ShoppingTaskView
        dataSource="mock"
        connectBaseUrl="http://127.0.0.1:6660"
        detail={detail}
        taskUpdatedAt={detail.taskUpdatedAt}
      />,
    ),
  );
}

function getCheckbox(label: string): HTMLButtonElement {
  const checkbox = container.querySelector<HTMLButtonElement>(
    `[role="checkbox"][aria-label="${label}"]`,
  );
  expect(checkbox, `Missing checkbox: ${label}`).not.toBeNull();
  return checkbox!;
}

function getButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label ||
      candidate.textContent?.trim() === label,
  );
  expect(button, `Missing button: ${label}`).toBeDefined();
  return button!;
}

async function click(button: HTMLButtonElement) {
  await act(async () => button.click());
}

async function inputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
    element,
    value,
  );
  await act(async () =>
    element.dispatchEvent(new Event("input", { bubbles: true })),
  );
}

describe("shopping task checklist", () => {
  it("records a full purchase with one check and restores it with another", async () => {
    await render([water]);
    expect(
      getCheckbox("将矿泉水记为全部购买").getAttribute("aria-checked"),
    ).toBe("false");
    expect(getButton("还有 1 种商品待处理").disabled).toBe(true);

    await click(getCheckbox("将矿泉水记为全部购买"));
    expect(saveShoppingTaskItem).toHaveBeenCalledWith(
      {
        errandTaskId: "7001",
        errandTaskItemId: "7101",
        purchasedQuantity: 3,
        nonPurchaseReason: null,
        itemUpdatedAt: water.updatedAt,
      },
      expect.any(Object),
    );
    expect(
      getCheckbox("将矿泉水恢复为待采购").getAttribute("aria-checked"),
    ).toBe("true");
    expect(getButton("确认完成采购").disabled).toBe(false);

    await click(getCheckbox("将矿泉水恢复为待采购"));
    expect(saveShoppingTaskItem).toHaveBeenCalledTimes(2);
    expect(saveShoppingTaskItem.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        errandTaskItemId: "7101",
        purchasedQuantity: -1,
        nonPurchaseReason: null,
        itemUpdatedAt: "2026-07-18T02:00:01Z",
      }),
    );
    expect(
      getCheckbox("将矿泉水记为全部购买").getAttribute("aria-checked"),
    ).toBe("false");
    expect(getButton("还有 1 种商品待处理").disabled).toBe(true);
  });

  it("edits pending and already recorded quantities in one dialog", async () => {
    await render([water, bread]);
    await click(getButton("记录矿泉水的采购结果"));
    expect(container.textContent).toContain("记录采购");
    const quantity = () =>
      container.querySelector<HTMLInputElement>("#purchase-quantity")!;
    expect(quantity().value).toBe("3");
    await inputValue(quantity(), "2");
    await click(getButton("保存采购结果"));
    expect(saveShoppingTaskItem.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        errandTaskItemId: "7101",
        purchasedQuantity: 2,
        nonPurchaseReason: null,
        itemUpdatedAt: water.updatedAt,
      }),
    );

    await click(getButton("修改面包的采购结果"));
    expect(quantity().value).toBe("1");
    await inputValue(quantity(), "0");
    const reason =
      container.querySelector<HTMLTextAreaElement>("#purchase-reason");
    expect(reason).not.toBeNull();
    await inputValue(reason!, "缺货");
    await click(getButton("保存采购结果"));
    expect(saveShoppingTaskItem).toHaveBeenCalledTimes(2);
    expect(saveShoppingTaskItem.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        errandTaskItemId: "7102",
        purchasedQuantity: 0,
        nonPurchaseReason: "缺货",
        itemUpdatedAt: bread.updatedAt,
      }),
    );
    expect(getCheckbox("将面包恢复为待采购").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("rejects invalid quantities and locks other rows while a save is pending", async () => {
    await render([water, { ...bread, purchasedQuantity: null }]);
    await click(getButton("记录矿泉水的采购结果"));
    const quantity =
      container.querySelector<HTMLInputElement>("#purchase-quantity")!;
    for (const value of ["", "1.5", "-1", "4"]) {
      await inputValue(quantity, value);
      expect(getButton("保存采购结果").disabled).toBe(true);
      expect(container.textContent).toContain("请输入0至3之间的整数");
    }
    expect(saveShoppingTaskItem).not.toHaveBeenCalled();

    let rejectSave: (reason?: unknown) => void = () => undefined;
    saveShoppingTaskItem.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    await inputValue(quantity, "1");
    await click(getButton("保存采购结果"));
    expect(saveShoppingTaskItem).toHaveBeenCalledTimes(1);
    expect(getCheckbox("将面包记为全部购买").disabled).toBe(true);
    expect(getButton("保存中").disabled).toBe(true);
    await click(getCheckbox("将面包记为全部购买"));
    expect(saveShoppingTaskItem).toHaveBeenCalledTimes(1);

    await act(async () => rejectSave(new Error("版本冲突")));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
      getCheckbox("将矿泉水记为全部购买").getAttribute("aria-checked"),
    ).toBe("false");
    expect(getCheckbox("将矿泉水记为全部购买").disabled).toBe(true);
    expect(getCheckbox("将面包记为全部购买").disabled).toBe(true);
    expect(getButton("还有 2 种商品待处理").disabled).toBe(true);
    expect(saveShoppingTaskItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      outcome: "the same uncommitted item version",
      refreshedItem: { ...water },
      checkboxLabel: "将矿泉水记为全部购买",
      checked: "false",
      footerLabel: "还有 1 种商品待处理",
      footerDisabled: true,
    },
    {
      outcome: "a newer committed item version",
      refreshedItem: {
        ...water,
        purchasedQuantity: 3,
        updatedAt: "2026-07-18T02:00:01Z",
      },
      checkboxLabel: "将矿泉水恢复为待采购",
      checked: "true",
      footerLabel: "确认完成采购",
      footerDisabled: false,
    },
  ])(
    "reconciles a failed save after refresh returns $outcome",
    async (scenario) => {
      const originalItems = [water];
      saveShoppingTaskItem.mockRejectedValueOnce(new Error("响应中断"));
      await render(originalItems);
      await click(getCheckbox("将矿泉水记为全部购买"));

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(getCheckbox("将矿泉水记为全部购买").disabled).toBe(true);
      await render(originalItems);
      expect(getCheckbox("将矿泉水记为全部购买").disabled).toBe(true);

      await render([scenario.refreshedItem]);
      const checkbox = getCheckbox(scenario.checkboxLabel);
      expect(checkbox.disabled).toBe(false);
      expect(checkbox.getAttribute("aria-checked")).toBe(scenario.checked);
      expect(getButton(scenario.footerLabel).disabled).toBe(
        scenario.footerDisabled,
      );
      expect(saveShoppingTaskItem).toHaveBeenCalledTimes(1);
    },
  );
});
