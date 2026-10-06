// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "../components/mobile-bottom-nav";

const { push, waitForCleanup } = vi.hoisted(() => ({
  push: vi.fn(),
  waitForCleanup: vi.fn<() => Promise<void>>(),
}));

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
  vi.stubGlobal("h5sdk", undefined);
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

  it("waits for drawer history cleanup before navigating to scan entry", async () => {
    let finishCleanup!: () => void;
    waitForCleanup.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
    );
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(waitForCleanup).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    await act(async () => finishCleanup());
    expect(push).toHaveBeenCalledExactlyOnceWith("/publish/spot?entry=scan");
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

  it("keeps scan routing in Feishu and hides scan outside Feishu", async () => {
    vi.stubGlobal("h5sdk", { ready: vi.fn(), config: vi.fn() });
    await renderNav();
    await clickButton("上架现货");
    await clickButton("扫码录入");
    expect(push).toHaveBeenCalledExactlyOnceWith("/publish/spot?entry=scan");

    await renderNav(false);
    await clickButton("上架现货");
    expect(getOpenDialog().textContent).toContain("手动输入");
    expect(getOpenDialog().textContent).not.toContain("扫码录入");
    await clickButton("手动输入");
    expect(getOpenDialog().textContent).toContain("输入商品条码");
  });
});
