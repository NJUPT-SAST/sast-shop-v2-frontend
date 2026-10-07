// @vitest-environment jsdom

import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigation, agreementMount, agreementUnmount } = vi.hoisted(() => ({
  navigation: { pathname: "/orders" },
  agreementMount: vi.fn(),
  agreementUnmount: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@workspace/ui/components/sonner", () => ({ Toaster: () => null }));
vi.mock("../components/auth-bootstrap", () => ({
  AuthBootstrap: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../components/profile-dialogs-provider", () => ({
  ProfileDialogsProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("../lib/app-config", () => ({
  mobileAppConfig: {
    appOrigin: "http://localhost:3001",
    dataSource: "local",
    connectBaseUrl: "http://127.0.0.1:1323",
  },
}));
vi.mock("../lib/auth-mode", () => ({ getServerAuthMode: () => "off" }));
vi.mock("@workspace/ui/components/transaction-agreement", () => ({
  TransactionAgreementProvider: ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    useEffect(() => {
      agreementMount();
      return () => agreementUnmount();
    }, []);
    return children;
  },
}));
vi.mock("../components/mobile-shell", async () => {
  const { MobilePageTransition } =
    await import("../components/mobile-page-transition");
  return {
    MobileShell: ({ children }: { children: React.ReactNode }) => (
      <MobilePageTransition>{children}</MobilePageTransition>
    ),
  };
});

import RootLayout from "../app/layout";

let root: Root;
let originalAnimate: PropertyDescriptor | undefined;
const animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
const animate = vi.fn<HTMLElement["animate"]>(() => {
  const animation = { cancel: vi.fn() };
  animations.push(animation);
  return animation as unknown as Animation;
});

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () =>
    Object.assign(new EventTarget(), { matches: false }),
  );
  originalAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  navigation.pathname = "/orders";
  agreementMount.mockClear();
  agreementUnmount.mockClear();
  animate.mockClear();
  animations.length = 0;
  root = createRoot(document);
});

afterEach(async () => {
  await act(async () => root.unmount());
  if (originalAnimate) {
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  }
  vi.unstubAllGlobals();
});

async function render(pathname: string, content: string) {
  navigation.pathname = pathname;
  await act(async () =>
    root.render(
      <RootLayout>
        <section>{content}</section>
      </RootLayout>,
    ),
  );
}

describe("mobile root layout transition lifetime", () => {
  it("keeps the shell alive through route agreement resets and loading content replacement", async () => {
    await render("/orders", "订单列表");
    expect(animate).not.toHaveBeenCalled();
    expect(agreementMount).toHaveBeenCalledTimes(1);
    const transitionContainer =
      document.querySelector("section")!.parentElement;

    await render("/orders/spot/1", "正在加载订单");
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]![0]).toEqual([
      { transform: "translateX(24px)", opacity: 0.8 },
      { transform: "translateX(0)", opacity: 1 },
    ]);
    expect(agreementUnmount).toHaveBeenCalledTimes(1);
    expect(agreementMount).toHaveBeenCalledTimes(2);
    expect(document.querySelector("section")!.parentElement).toBe(
      transitionContainer,
    );

    await render("/orders/spot/1", "订单详情已加载");
    expect(document.body.textContent).toContain("订单详情已加载");
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animations[0]!.cancel).not.toHaveBeenCalled();
    expect(agreementMount).toHaveBeenCalledTimes(2);

    await render("/orders", "订单列表");
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1]![0]).toEqual([
      { transform: "translateX(-24px)", opacity: 0.8 },
      { transform: "translateX(0)", opacity: 1 },
    ]);
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
    expect(animations[1]!.cancel).not.toHaveBeenCalled();
    expect(agreementUnmount).toHaveBeenCalledTimes(2);
    expect(agreementMount).toHaveBeenCalledTimes(3);
    expect(document.querySelector("section")!.parentElement).toBe(
      transitionContainer,
    );
  });
});
