// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProfileDialogsProvider,
  useProfileDialogs,
} from "../components/profile-dialogs-provider";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }));

function Menu() {
  const { openAddressDialog } = useProfileDialogs();
  return <button onClick={openAddressDialog}>打开地址簿</button>;
}
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    window.clearTimeout(id),
  );
  window.history.replaceState(null, "", "/profile");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    await new Promise((resolve) => window.setTimeout(resolve, 30));
  });
  container.remove();
  vi.unstubAllGlobals();
});
async function settle() {
  await act(
    async () => new Promise((resolve) => window.setTimeout(resolve, 30)),
  );
}
async function render() {
  await act(async () =>
    root.render(
      <ProfileDialogsProvider
        dataSource="local"
        connectBaseUrl="http://localhost/api/connect"
        overview={{
          user: { id: "10001", name: "同学", avatarUrl: "" },
          addresses: [],
          defaultAddress: null,
          paymentQrCodes: [],
        }}
        error={null}
      >
        <Menu />
      </ProfileDialogsProvider>,
    ),
  );
  await settle();
}
async function click(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
  await settle();
}
function openTitle() {
  return document.querySelector(
    '[data-slot="drawer-content"][data-state="open"] [data-slot="drawer-title"]',
  )?.textContent;
}
async function back() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => window.setTimeout(resolve, 30));
  });
  await settle();
}

describe("profile drawers with real shared browser history", () => {
  it("returns from adding an address to the address book, then closes it on a second back", async () => {
    await render();
    await click("打开地址簿");
    expect(openTitle()).toBe("地址簿");
    await click("添加地址");
    expect(openTitle()).toBe("添加地址");
    await back();
    expect(openTitle()).toBe("地址簿");
    await back();
    expect(openTitle()).toBeUndefined();
    expect(window.location.pathname).toBe("/profile");
    expect(window.location.search).toBe("");
    await act(
      async () => new Promise((resolve) => window.setTimeout(resolve, 450)),
    );
    expect(openTitle()).toBeUndefined();
  });
});
