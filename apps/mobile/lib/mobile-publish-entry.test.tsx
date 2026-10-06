// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LarkClientApi, LarkH5Sdk } from "@sast-shop/api";
import { toast } from "sonner";
import { MobileBottomNav } from "../components/mobile-bottom-nav";

const { push, waitForCleanup } = vi.hoisted(() => ({
  push: vi.fn(),
  waitForCleanup: vi.fn<() => Promise<void>>(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), message: vi.fn() },
}));

const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>();
const configure = vi.fn<NonNullable<LarkH5Sdk["config"]>>();
const fetchConfig = vi.fn<typeof fetch>();
const jsapiConfig = {
  appId: "cli_test",
  timestamp: "1780000000",
  nonceStr: "test-nonce",
  signature: "test-signature",
};

vi.mock("@workspace/ui/lib/drawer-history", () => ({
  waitForDrawerHistoryCleanup: waitForCleanup,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("../components/mobile-scroll-context", () => ({
  useMobileScroll: () => ({
    handleCurrentRoutePress: vi.fn(),
    scrollToTop: vi.fn(),
  }),
}));
vi.mock("@workspace/ui/components/drawer", async () => {
  const React = await import("react");
  const DrawerContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>({
    open: false,
    onOpenChange: () => undefined,
  });
  const Drawer = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DrawerContext.Provider>
  );
  const DrawerTrigger = ({ children }: { children: React.ReactNode }) => {
    const { onOpenChange } = React.useContext(DrawerContext);
    if (
      !React.isValidElement<{ onClick?: React.MouseEventHandler }>(children)
    ) {
      return null;
    }
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent) => {
        children.props.onClick?.(event);
        onOpenChange(true);
      },
    });
  };
  const DrawerClose = ({ children }: { children: React.ReactNode }) => {
    const { onOpenChange } = React.useContext(DrawerContext);
    if (
      !React.isValidElement<{ onClick?: React.MouseEventHandler }>(children)
    ) {
      return null;
    }
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent) => {
        children.props.onClick?.(event);
        onOpenChange(false);
      },
    });
  };
  const DrawerContent = ({ children }: { children: React.ReactNode }) => {
    const { open, onOpenChange } = React.useContext(DrawerContext);
    return open ? (
      <div role="dialog">
        {children}
        <button
          type="button"
          aria-label="关闭弹层"
          onClick={() => onOpenChange(false)}
        />
      </div>
    ) : null;
  };
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader: Container,
    DrawerFooter: Container,
    DrawerTitle: Container,
    DrawerDescription: Container,
  };
});

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  configure.mockReset().mockImplementation((options) => {
    options.onSuccess?.({});
  });
  scanCode.mockReset().mockImplementation((options) => {
    options.success({ result: "0012345" });
  });
  fetchConfig
    .mockReset()
    .mockImplementation(async () => Response.json(jsapiConfig));
  vi.stubGlobal("h5sdk", {
    config: configure,
    ready: (callback: () => void) => callback(),
  });
  vi.stubGlobal("tt", { scanCode });
  vi.stubGlobal("fetch", fetchConfig);
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.message).mockReset();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
  );
  push.mockReset();
  waitForCleanup.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderNav(feishu = true) {
  if (!feishu) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
    );
  }
  await act(async () => root.render(<MobileBottomNav />));
}

function getOpenDialog(): HTMLElement {
  const dialogs = container.querySelectorAll<HTMLElement>('[role="dialog"]');
  expect(dialogs).toHaveLength(1);
  return dialogs[0]!;
}

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      item.textContent?.trim() === label,
  );
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

async function submitBarcode() {
  const form = getOpenDialog().querySelector("form");
  expect(form).not.toBeNull();
  await act(async () => {
    form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

async function enterBarcode(value: string) {
  const input = getOpenDialog().querySelector<HTMLInputElement>("input");
  expect(input).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("mobile publish entry", () => {
  it("waits for drawer history cleanup before navigating with a valid manual barcode", async () => {
    let finishCleanup!: () => void;
    waitForCleanup.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
    );
    await renderNav();
    await clickButton("上架现货");
    await clickButton("手动输入");
    await enterBarcode("0012345");
    await submitBarcode();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(waitForCleanup).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    await act(async () => finishCleanup());
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/publish/spot?entry=manual&barcode=0012345",
    );
  });

  it("scans in place and waits for drawer cleanup before navigating with the result", async () => {
    let finishScan!: Parameters<
      NonNullable<LarkClientApi["scanCode"]>
    >[0]["success"];
    scanCode.mockImplementationOnce((options) => {
      finishScan = options.success;
    });
    let finishCleanup!: () => void;
    waitForCleanup.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
    );
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");
    expect(getOpenDialog().textContent).toContain("正在扫码");
    expect(waitForCleanup).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(fetchConfig).toHaveBeenCalledWith(
      `/api/auth/jsapi-config?url=${encodeURIComponent(window.location.href)}`,
      { cache: "no-store" },
    );
    await act(async () => finishScan({ result: " 0012345 " }));
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(waitForCleanup).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    await act(async () => finishCleanup());
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/publish/spot?entry=scan&barcode=0012345",
    );
  });

  it("keeps the entry unchanged on cancellation and allows retry or manual input", async () => {
    scanCode.mockImplementationOnce((options) => {
      options.fail({ errno: 1505002, errString: "用户取消扫码" });
    });
    await renderNav();
    await clickButton("上架现货");
    const dialog = getOpenDialog();
    await clickButton("扫码录入");

    expect(getOpenDialog()).toBe(dialog);
    expect(dialog.textContent).toContain("扫码录入");
    expect(push).not.toHaveBeenCalled();
    expect(waitForCleanup).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.message).not.toHaveBeenCalled();
    await clickButton("扫码录入");
    expect(scanCode).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/publish/spot?entry=scan&barcode=0012345",
    );

    await clickButton("上架现货");
    await clickButton("手动输入");
    expect(getOpenDialog().querySelector("input")).not.toBeNull();
  });

  it("keeps the entry available when the SDK is not ready", async () => {
    vi.stubGlobal("tt", {});
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");

    expect(getOpenDialog().textContent).toContain("扫码录入");
    expect(push).not.toHaveBeenCalled();
    expect(fetchConfig).not.toHaveBeenCalled();
    expect(toast.message).toHaveBeenCalledWith(
      "飞书扫码组件尚未就绪，请稍后重试或手动输入",
    );
    await clickButton("手动输入");
    expect(getOpenDialog().querySelector("input")).not.toBeNull();
  });

  it("keeps the entry available after failed authentication or an invalid scan", async () => {
    fetchConfig.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");
    expect(scanCode).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("扫码鉴权暂不可用，请稍后再试");
    scanCode.mockImplementationOnce((options) => {
      options.success({ result: "invalid" });
    });
    await clickButton("扫码录入");
    expect(toast.error).toHaveBeenCalledWith(
      "扫描结果不是有效商品条码，请手动输入",
    );
    expect(push).not.toHaveBeenCalled();
    expect(waitForCleanup).not.toHaveBeenCalled();
    expect(getOpenDialog().textContent).toContain("扫码录入");
  });

  it("prevents repeated scans and ignores a result after closing and reopening", async () => {
    let finishScan!: Parameters<
      NonNullable<LarkClientApi["scanCode"]>
    >[0]["success"];
    scanCode.mockImplementationOnce((options) => {
      finishScan = options.success;
    });
    await renderNav();
    await clickButton("上架现货");
    const scanButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "扫码录入",
    )!;
    await act(async () => {
      scanButton.click();
      scanButton.click();
    });
    expect(configure).toHaveBeenCalledOnce();
    expect(scanCode).toHaveBeenCalledOnce();
    expect(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "手动输入",
      )?.disabled,
    ).toBe(true);
    await clickButton("关闭弹层");
    await clickButton("上架现货");
    await act(async () => finishScan({ result: "0012345" }));
    expect(push).not.toHaveBeenCalled();
    expect(waitForCleanup).not.toHaveBeenCalled();
    expect(getOpenDialog().textContent).toContain("扫码录入");
    await clickButton("扫码录入");
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/publish/spot?entry=scan&barcode=0012345",
    );
  });

  it("does not open the scanner if the entry closes during authentication", async () => {
    let finishAuth!: () => void;
    configure.mockImplementationOnce((options) => {
      finishAuth = () => options.onSuccess?.({});
    });
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");
    await clickButton("关闭弹层");
    await act(async () => finishAuth());
    expect(scanCode).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores a result after unmounting", async () => {
    let finishScan!: Parameters<
      NonNullable<LarkClientApi["scanCode"]>
    >[0]["success"];
    scanCode.mockImplementationOnce((options) => {
      finishScan = options.success;
    });
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");
    await act(async () => root.render(null));
    await act(async () => finishScan({ result: "0012345" }));
    expect(push).not.toHaveBeenCalled();
    expect(waitForCleanup).not.toHaveBeenCalled();
  });

  it("offers entry methods first, then validates and submits a manual barcode", async () => {
    await renderNav();
    await clickButton("上架现货");

    expect(getOpenDialog().textContent).toContain("手动输入");
    expect(getOpenDialog().textContent).toContain("扫码录入");
    expect(getOpenDialog().querySelector("input")).toBeNull();

    await clickButton("手动输入");
    expect(getOpenDialog().textContent).toContain("输入商品条码");
    expect(getOpenDialog().querySelector("input")).not.toBeNull();

    await submitBarcode();
    expect(push).not.toHaveBeenCalled();
    expect(getOpenDialog().textContent).toContain("请输入商品条码");

    await enterBarcode("12A");
    await submitBarcode();
    expect(push).not.toHaveBeenCalled();
    expect(getOpenDialog().textContent).toContain("商品条码只能包含数字");

    await enterBarcode(" 0012345 ");
    await submitBarcode();
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/publish/spot?entry=manual&barcode=0012345",
    );
  });

  it("clears the manual draft and error after closing and reopening", async () => {
    await renderNav();
    await clickButton("上架现货");
    await clickButton("手动输入");
    await enterBarcode("ABC");
    await submitBarcode();
    expect(getOpenDialog().textContent).toContain("商品条码只能包含数字");

    await clickButton("关闭弹层");
    await clickButton("上架现货");
    expect(getOpenDialog().textContent).toContain("手动输入");
    expect(getOpenDialog().querySelector("input")).toBeNull();
    await clickButton("手动输入");

    expect(
      getOpenDialog().querySelector<HTMLInputElement>("input")?.value,
    ).toBe("");
    expect(getOpenDialog().textContent).not.toContain("商品条码只能包含数字");
  });

  it("hides scanning outside Feishu", async () => {
    await renderNav(false);
    await clickButton("上架现货");
    expect(getOpenDialog().textContent).toContain("手动输入");
    expect(getOpenDialog().textContent).not.toContain("扫码录入");
    await clickButton("手动输入");
    expect(getOpenDialog().textContent).toContain("输入商品条码");
  });
});
