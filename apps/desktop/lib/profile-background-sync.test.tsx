// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ProfileOverview } from "@sast-shop/api";
import { ProfileManagement } from "../components/profile-management";

const { updateAddress, listPaymentQrCodes, listAddresses } = vi.hoisted(() => ({
  updateAddress: vi.fn(),
  listPaymentQrCodes: vi.fn(),
  listAddresses: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  updateAddress,
  listPaymentQrCodes,
  createAddress: vi.fn(),
  deleteAddress: vi.fn(),
  listAddresses,
  updatePaymentQrCode: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ openAgreement: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@workspace/ui/components/dialog", () => {
  const Content = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: ReactNode;
    }) =>
      open ? (
        <div role="dialog">
          {children}
          <button onClick={() => onOpenChange(false)}>关闭弹窗</button>
        </div>
      ) : null,
    DialogContent: Content,
    DialogHeader: Content,
    DialogFooter: Content,
    DialogTitle: Content,
    DialogDescription: Content,
  };
});

const address = {
  id: "1001",
  recipientName: "南邮同学",
  recipientPhone: "13800000001",
  province: "江苏省",
  city: "南京市",
  district: "栖霞区",
  detailAddress: "仙林校区",
  isDefault: true,
};
const overview: ProfileOverview = {
  user: { id: "10001", name: "同学", avatarUrl: "" },
  addresses: [address],
  defaultAddress: address,
  paymentQrCodes: [],
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  updateAddress.mockReset();
  listAddresses.mockReset().mockResolvedValue([address]);
  listPaymentQrCodes
    .mockReset()
    .mockResolvedValue([{ id: "2", channel: "wechat", content: "wxp://test" }]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(
  initialQrError: string | null = null,
  feedbackFormUrl: string | null = null,
  initialOverview: ProfileOverview = overview,
) {
  await act(async () =>
    root.render(
      <ProfileManagement
        initialOverview={initialOverview}
        error={null}
        initialQrError={initialQrError}
        dataSource="mock"
        connectBaseUrl="http://127.0.0.1:6660"
        feedbackFormUrl={feedbackFormUrl}
      />,
    ),
  );
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) =>
      element.getAttribute("aria-label") === label ||
      element.textContent?.startsWith(label),
  );
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}
async function changeRecipient(value: string) {
  await act(async () => {
    const input =
      container.querySelector<HTMLInputElement>("#address-recipient")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("desktop profile background synchronization", () => {
  it("updates the address list when cached data revalidates", async () => {
    await render();
    await click("地址簿");
    expect(container.textContent).toContain(address.recipientName);
    const latestAddress = { ...address, recipientName: "更新后的收货人" };
    await render(null, null, {
      ...overview,
      addresses: [latestAddress],
      defaultAddress: latestAddress,
    });
    expect(container.textContent).toContain(latestAddress.recipientName);
    expect(container.textContent).not.toContain(address.recipientName);
  });

  it("keeps an open address draft during revalidation and applies the new list after closing", async () => {
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await changeRecipient("正在输入的收货人");
    const latestAddress = { ...address, recipientName: "后台更新后的收货人" };
    await render(null, null, {
      ...overview,
      addresses: [latestAddress],
      defaultAddress: latestAddress,
    });
    expect(
      container.querySelector<HTMLInputElement>("#address-recipient")?.value,
    ).toBe("正在输入的收货人");
    await click("关闭弹窗");
    expect(container.textContent).toContain(latestAddress.recipientName);
  });
});
