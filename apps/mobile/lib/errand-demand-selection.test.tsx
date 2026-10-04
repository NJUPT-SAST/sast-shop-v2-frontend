// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrandDemandDetailGroup } from "@sast-shop/api";
import { ErrandDemandDetail } from "../components/errand-demand-detail";

const { createErrandTask, ensureAgreement } = vi.hoisted(() => ({
  createErrandTask: vi.fn(),
  ensureAgreement: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@sast-shop/api", () => ({ createErrandTask }));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
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
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const details: ErrandDemandDetailGroup[] = [
  {
    errandDemandId: "9001",
    productTemplate: {
      id: "4001",
      title: "矿泉水",
      description: "550ml",
      priceCents: 200,
      storeId: "3001",
      mainImageUrl: "",
      barcode: "690000000001",
      updatedAt: "2026-07-18T02:00:00Z",
    },
    estimatedUnitPriceCents: 200,
    quantity: 9,
    requesters: [
      {
        requesterId: "1001",
        requesterName: "李同学",
        requesterAvatarUrl: "",
        quantity: 2,
        serviceFeePerUnitCents: 50,
        errandDemandItemId: "9101",
        deadline: null,
        updatedAt: "2026-07-18T02:00:00Z",
      },
      {
        requesterId: "1002",
        requesterName: "陈同学",
        requesterAvatarUrl: "",
        quantity: 3,
        serviceFeePerUnitCents: 100,
        errandDemandItemId: "9102",
        deadline: null,
        updatedAt: "2026-07-18T02:00:00Z",
      },
      {
        requesterId: "1003",
        requesterName: "王同学",
        requesterAvatarUrl: "",
        quantity: 4,
        serviceFeePerUnitCents: 100,
        errandDemandItemId: "9103",
        deadline: null,
        updatedAt: null,
      },
    ],
  },
];

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  createErrandTask.mockReset();
  ensureAgreement.mockReset();
  ensureAgreement.mockResolvedValue(true);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ErrandDemandDetail
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1327"
        storeId="3001"
        storeName="SAST 小卖部"
        details={details}
      />,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function getLabel(text: string): HTMLLabelElement {
  const label = Array.from(container.querySelectorAll("label")).find((item) =>
    item.textContent?.includes(text),
  );
  expect(label, `Missing row label: ${text}`).toBeDefined();
  return label!;
}

function getCheckbox(label: HTMLLabelElement): HTMLButtonElement {
  const checkbox = label.querySelector<HTMLButtonElement>('[role="checkbox"]');
  expect(checkbox).not.toBeNull();
  return checkbox!;
}

async function clickLabel(text: string) {
  await act(async () => getLabel(text).click());
}

describe("errand demand selection controls", () => {
  it("does not accept a task when the transaction agreement is declined", async () => {
    ensureAgreement.mockResolvedValue(false);
    await clickLabel("李同学");
    const confirmButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "确认接单",
      );
    await act(async () => confirmButtons()[0]!.click());
    await act(async () => confirmButtons().at(-1)!.click());

    expect(ensureAgreement).toHaveBeenCalledTimes(1);
    expect(createErrandTask).not.toHaveBeenCalled();
  });

  it("selects a row once, shows mixed state, then toggles all selectable rows", async () => {
    const first = getCheckbox(getLabel("李同学"));
    const second = getCheckbox(getLabel("陈同学"));
    const all = getCheckbox(getLabel("全选"));
    expect(first.getAttribute("aria-checked")).toBe("false");
    expect(all.getAttribute("aria-checked")).toBe("false");

    await clickLabel("李同学");
    expect(first.getAttribute("aria-checked")).toBe("true");
    expect(second.getAttribute("aria-checked")).toBe("false");
    expect(all.getAttribute("aria-checked")).toBe("mixed");
    expect(container.textContent).toContain("已选 1 行 · 2 件");
    expect(container.textContent).toContain("¥5");

    await clickLabel("全选");
    expect(first.getAttribute("aria-checked")).toBe("true");
    expect(second.getAttribute("aria-checked")).toBe("true");
    expect(all.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("已选 2 行 · 5 件");
    expect(container.textContent).toContain("¥14");

    await clickLabel("全选");
    expect(first.getAttribute("aria-checked")).toBe("false");
    expect(second.getAttribute("aria-checked")).toBe("false");
    expect(all.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("已选 0 行 · 0 件");
  });

  it("does not select a row with no current demand version", async () => {
    const unavailable = getCheckbox(getLabel("王同学"));
    expect(unavailable.disabled).toBe(true);

    await clickLabel("王同学");

    expect(unavailable.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("已选 0 行 · 0 件");
  });
});
