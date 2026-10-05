// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError, type ProfileOverview } from "@sast-shop/api";
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
) {
  await act(async () =>
    root.render(
      <ProfileManagement
        initialOverview={overview}
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
async function submit() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
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

describe("desktop profile dialogs", () => {
  it("keeps address values and save failures visible when submitting the form", async () => {
    updateAddress.mockRejectedValue(new Error("地址服务暂不可用"));
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await changeRecipient("新收货人");
    await submit();
    expect(updateAddress).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector<HTMLInputElement>("#address-recipient")?.value,
    ).toBe("新收货人");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "地址服务暂不可用",
    );
    expect(
      container
        .querySelector('button[form="desktop-address-form"]')
        ?.getAttribute("type"),
    ).toBe("submit");
  });

  it("keeps an uncertain save locked until the saved address is confirmed", async () => {
    updateAddress.mockRejectedValue(new Error("响应丢失"));
    listAddresses.mockRejectedValue(new Error("读取失败"));
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await changeRecipient("新收货人");
    await submit();
    await submit();
    expect(updateAddress).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("核实保存结果");
    listAddresses.mockResolvedValue([
      { ...address, recipientName: "新收货人" },
    ]);
    await click("核实保存结果");
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("新收货人");
  });

  it("keeps an uncertain save locked when a successful read still has the old address", async () => {
    updateAddress.mockRejectedValue(new Error("响应丢失"));
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await changeRecipient("新收货人");
    await submit();
    await submit();
    expect(updateAddress).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("核实保存结果");

    await click("取消");
    const editButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="编辑南邮同学的地址"]',
    );
    expect(editButton?.disabled).toBe(true);
    await click("继续核实保存");
    expect(
      container.querySelector<HTMLInputElement>("#address-recipient")?.value,
    ).toBe("新收货人");
    await submit();
    expect(updateAddress).toHaveBeenCalledTimes(1);

    listAddresses.mockResolvedValue([
      { ...address, recipientName: "新收货人" },
    ]);
    await click("核实保存结果");
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("新收货人");
  });

  it("does not confirm an unchanged default flag after an uncertain save", async () => {
    updateAddress.mockRejectedValue(new Error("响应丢失"));
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[role="switch"]')!.click(),
    );
    await submit();
    expect(updateAddress).toHaveBeenCalledWith(
      address.id,
      expect.objectContaining({ isDefault: false }),
      expect.anything(),
    );
    expect(container.querySelector("form")).not.toBeNull();
    await submit();
    expect(updateAddress).toHaveBeenCalledTimes(1);
    listAddresses.mockResolvedValue([{ ...address, isDefault: false }]);
    await click("核实保存结果");
    expect(container.querySelector("form")).toBeNull();
  });

  it("allows correcting a definitively rejected address without a verification lock", async () => {
    updateAddress.mockRejectedValue(new ValidationError("收件人不符合要求"));
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "收件人不符合要求",
    );
    expect(container.textContent).not.toContain("核实保存结果");
    expect(listAddresses).not.toHaveBeenCalled();
    await changeRecipient("新收货人");
    updateAddress.mockResolvedValue({ ...address, recipientName: "新收货人" });
    await submit();
    expect(updateAddress).toHaveBeenCalledTimes(2);
    expect(container.querySelector("form")).toBeNull();
  });

  it("blocks duplicate submissions and dismissal while the save is pending", async () => {
    let finish!: (value: typeof address) => void;
    updateAddress.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await render();
    await click("地址簿");
    await click("编辑南邮同学的地址");
    await act(async () => {
      const form = container.querySelector("form")!;
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await click("关闭弹窗");
    expect(container.textContent).toContain("编辑地址");
    expect(updateAddress).toHaveBeenCalledTimes(1);
    await act(async () => finish(address));
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("地址簿");
  });

  it("allows retrying QR loading without losing the address book", async () => {
    await render("收款码加载失败");
    await click("收款码");
    await click("重新加载");
    expect(listPaymentQrCodes).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("已上传");
    await click("关闭弹窗");
    await click("地址簿");
    expect(container.textContent).toContain("南邮同学");
  });

  it("opens help inside Feishu when the CDN SDK has no browser field", async () => {
    const feedbackFormUrl = "https://njupt-sast.feishu.cn/share/base/form/test";
    vi.stubGlobal("h5sdk", { ready: vi.fn(), config: vi.fn() });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh) Feishu/7.35.0",
    );
    await render(null, feedbackFormUrl);
    const link = Array.from(container.querySelectorAll("a")).find((element) =>
      element.textContent?.includes("帮助与反馈"),
    );
    expect(link).toBeDefined();
    const assign = vi.fn();
    const originalWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(originalWindow, {
        get(target, key) {
          return key === "location"
            ? { assign }
            : Reflect.get(target, key, target);
        },
      }),
    );
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    try {
      await act(async () => link!.dispatchEvent(click));
    } finally {
      vi.stubGlobal("window", originalWindow);
    }
    expect(click.defaultPrevented).toBe(true);
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(feedbackFormUrl)}`,
    );
  });
});
