// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PocketDetail, PocketFaceMatch } from "@sast-shop/api";
import { PocketMembersDrawer } from "../components/pocket/members-drawer";

const rpc = vi.hoisted(() => ({
  getPocketRecognition: vi.fn(),
  searchPocketParticipants: vi.fn(),
  replacePocketMembers: vi.fn(),
  previewPocketSplit: vi.fn(),
  publishPocket: vi.fn(),
  ensureAgreement: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getPocketRecognition: rpc.getPocketRecognition,
  searchPocketParticipants: rpc.searchPocketParticipants,
  replacePocketMembers: rpc.replacePocketMembers,
  previewPocketSplit: rpc.previewPocketSplit,
  publishPocket: rpc.publishPocket,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: rpc.ensureAgreement }),
}));
vi.mock("@workspace/ui/components/drawer", () => {
  const Section = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({ children }: { children: ReactNode }) => (
      <section role="dialog">{children}</section>
    ),
    DrawerContent: Section,
    DrawerDescription: Section,
    DrawerHeader: Section,
    DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DrawerFooter: ({ children }: { children: ReactNode }) => (
      <footer>{children}</footer>
    ),
  };
});

const owner = { id: "1", name: "同学甲", avatarUrl: "" };
const payer = { id: "2", name: "同学乙", avatarUrl: "" };
let container: HTMLDivElement;
let root: Root;
let detail: PocketDetail;

function button(text: string) {
  const result = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((item) => item.textContent === text);
  expect(result).toBeDefined();
  return result!;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  detail = {
    pocket: {
      id: "12",
      ownerId: owner.id,
      owner,
      title: "聚餐",
      totalCents: 10000,
      status: "draft",
      revision: "1",
      participantCount: 1,
      ownerShareCents: 10000,
      receivableCents: 0,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      cancelReason: "",
      isOwner: true,
    },
    isOwner: true,
    members: [
      {
        id: "owner-member",
        userId: owner.id,
        user: owner,
        selectionSource: "owner",
        faceMatchId: null,
        shareCents: 10000,
        paymentBillId: null,
        billStatus: "",
        billUpdatedAt: null,
        isOwner: true,
        albumAccess: "pending",
      },
    ],
    photos: [],
    jobs: [],
    notifications: [],
  };
  const match: PocketFaceMatch = {
    id: "face",
    photoId: "photo",
    recognitionJobId: "job",
    faceIndex: 0,
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    suggestedUserId: payer.id,
    confirmedUserId: null,
    candidates: [{ user: payer, score: 0.9 }],
    matchStatus: "suggested",
    resolution: "pending",
  };
  rpc.getPocketRecognition.mockResolvedValue([match]);
  rpc.ensureAgreement.mockResolvedValue(true);
  rpc.replacePocketMembers.mockResolvedValue({
    pocket: { ...detail.pocket, revision: "2" },
  });
  rpc.previewPocketSplit.mockResolvedValue({
    pocketId: "12",
    revision: "2",
    totalCents: 10000,
    participantCount: 2,
    ownerShareCents: 5000,
    receivableCents: 5000,
    members: [
      { ...detail.members[0], shareCents: 5000 },
      {
        ...detail.members[0],
        id: "payer-member",
        userId: payer.id,
        user: payer,
        shareCents: 5000,
        isOwner: false,
      },
    ],
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

async function search(value: string) {
  const input = container.querySelector<HTMLInputElement>(
    "#pocket-member-search",
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function mountFailedSearch() {
  vi.useFakeTimers();
  rpc.searchPocketParticipants.mockRejectedValue(new Error("搜索服务不可用"));
  await act(async () =>
    root.render(
      <PocketMembersDrawer
        detail={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    ),
  );
  await search("同学乙");
  await act(async () => vi.advanceTimersByTimeAsync(300));
}

it("shows a failed search without claiming there are no matching participants", async () => {
  await mountFailedSearch();
  expect(rpc.searchPocketParticipants).toHaveBeenCalledExactlyOnceWith(
    { pocketId: "12", query: "同学乙" },
    {},
  );
  expect(container.textContent).toContain("搜索服务不可用");
  expect(container.textContent).not.toContain("没有找到该姓名");
  expect(container.textContent).not.toContain("正在搜索姓名");
});

it("hides the previous search failure when changing or clearing the name", async () => {
  await mountFailedSearch();
  expect(container.textContent).toContain("搜索服务不可用");
  await search("同学丙");
  expect(container.textContent).not.toContain("搜索服务不可用");
  expect(container.textContent).toContain("正在搜索姓名");
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(container.textContent).toContain("搜索服务不可用");
  await search("");
  expect(container.textContent).not.toContain("搜索服务不可用");
  expect(container.textContent).not.toContain("没有找到该姓名");
  expect(container.textContent).not.toContain("正在搜索姓名");
  expect(container.querySelector('[aria-label="选择 同学乙"]')).not.toBeNull();
});

it("selects a candidate through the surrounding label and keeps publication behind confirmation", async () => {
  await act(async () =>
    root.render(
      <PocketMembersDrawer
        detail={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    ),
  );
  const checkbox = container.querySelector<HTMLButtonElement>(
    '[aria-label="选择 同学乙"]',
  )!;
  expect(button("核对分摊金额").disabled).toBe(true);
  await act(async () => checkbox.closest("label")!.click());
  expect(checkbox.getAttribute("aria-checked")).toBe("true");
  expect(button("核对分摊金额").disabled).toBe(false);
  await act(async () => button("核对分摊金额").click());
  expect(rpc.ensureAgreement).toHaveBeenCalledOnce();
  expect(rpc.replacePocketMembers).toHaveBeenCalledExactlyOnceWith(
    {
      pocketId: "12",
      expectedRevision: "1",
      members: [
        { userId: owner.id, selectionSource: "owner" },
        { userId: payer.id, selectionSource: "face", faceMatchId: "face" },
      ],
      requestId: expect.any(String),
    },
    {},
  );
  expect(rpc.previewPocketSplit).toHaveBeenCalledExactlyOnceWith(
    { pocketId: "12", expectedRevision: "2" },
    {},
  );
  expect(button("发起收款").disabled).toBe(true);
  expect(container.textContent).not.toContain("多分摊 0.01 元");
  await act(async () => button("发起收款").click());
  expect(rpc.publishPocket).not.toHaveBeenCalled();
  const consent =
    container.querySelector<HTMLButtonElement>('[role="checkbox"]')!;
  await act(async () => consent.closest("label")!.click());
  expect(button("发起收款").disabled).toBe(false);
  expect(rpc.publishPocket).not.toHaveBeenCalled();
});

it("explains a rounding remainder only when the returned member amounts differ", async () => {
  const split = await rpc.previewPocketSplit();
  rpc.previewPocketSplit.mockResolvedValue({
    ...split,
    totalCents: 10001,
    ownerShareCents: 5001,
    members: split.members.map(
      (member: { isOwner: boolean; shareCents: number }) => ({
        ...member,
        shareCents: member.isOwner ? 5001 : 5000,
      }),
    ),
  });
  await act(async () =>
    root.render(
      <PocketMembersDrawer
        detail={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    ),
  );
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="选择 同学乙"]')!
      .closest("label")!
      .click(),
  );
  await act(async () => button("核对分摊金额").click());
  expect(container.textContent).toContain("部分成员多分摊 0.01 元");
  expect(container.textContent).toContain("¥50.01");
  expect(container.textContent).toContain("¥50.00");
  expect(button("发起收款").disabled).toBe(true);
});
