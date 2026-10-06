// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreCreateDialog } from "../components/store-create-dialog";

const {
  createStore,
  waitForDrawerHistoryCleanup,
  push,
  replace,
  refresh,
  onOpenChange,
} = vi.hoisted(() => ({
  createStore: vi.fn(),
  waitForDrawerHistoryCleanup: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  onOpenChange: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  createStore,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));
vi.mock("@workspace/ui/lib/drawer-history", () => ({
  waitForDrawerHistoryCleanup,
}));
vi.mock("@workspace/ui/components/drawer", () => {
  const Content = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DrawerContent: Content,
    DrawerHeader: Content,
    DrawerTitle: Content,
    DrawerDescription: Content,
    DrawerFooter: Content,
    DrawerTrigger: Content,
  };
});
let root: Root;
let container: HTMLDivElement;
let completeCleanup: () => void;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  createStore.mockReset().mockResolvedValue({ id: "3099" });
  waitForDrawerHistoryCleanup.mockReset().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        completeCleanup = resolve;
      }),
  );
  push.mockReset();
  replace.mockReset();
  refresh.mockReset();
  onOpenChange.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(returnTo: string) {
  await act(async () =>
    root.render(
      <StoreCreateDialog
        open
        onOpenChange={onOpenChange}
        dataSource="local"
        connectBaseUrl="http://localhost/api/connect"
        returnTo={returnTo}
      />,
    ),
  );
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(
      "#mobile-dialog-store-name",
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "测试店铺");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const address = container.querySelector<HTMLTextAreaElement>(
      "#mobile-dialog-store-address",
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(address, "仙林校区");
    address.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

describe("store creation Drawer navigation", () => {
  it.each([
    {
      current: "/group",
      returnTo: "/group",
      navigation: "refresh",
      target: undefined,
    },
    {
      current: "/group/templates",
      returnTo: "/group/templates?create=1",
      navigation: "replace",
      target: "/group/templates?create=1&store=3099",
    },
    {
      current: "/publish/spot",
      returnTo: "/group",
      navigation: "push",
      target: "/group",
    },
  ])(
    "waits for actual history cleanup before $navigation",
    async ({ current, returnTo, navigation, target }) => {
      window.history.replaceState(null, "", current);
      await render(returnTo);
      await submit();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(waitForDrawerHistoryCleanup).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.disabled,
      ).toBe(true);
      await submit();
      expect(createStore).toHaveBeenCalledTimes(1);
      await act(async () => completeCleanup());
      const navigate = { push, replace, refresh }[
        navigation as "push" | "replace" | "refresh"
      ];
      if (target) expect(navigate).toHaveBeenCalledWith(target);
      else expect(navigate).toHaveBeenCalledTimes(1);
    },
  );

  it("does not navigate after the component unmounts while cleanup is pending", async () => {
    window.history.replaceState(null, "", "/publish/spot");
    await render("/group");
    await submit();
    await act(async () => root.render(null));
    await act(async () => completeCleanup());
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
