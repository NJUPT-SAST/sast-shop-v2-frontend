// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PocketPage from "../app/pocket/page";
import { MobileHeader } from "../components/mobile-header";
import { ProfileManagementClient } from "../components/profile-management-client";

const { navigation } = vi.hoisted(() => ({
  navigation: {
    pathname: "/orders",
    back: vi.fn(),
    replace: vi.fn(),
    redirect: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ back: navigation.back, replace: navigation.replace }),
  redirect: navigation.redirect,
}));
vi.mock("../hooks/use-secondary-scroll-title", () => ({
  useSecondaryScrollTitle: () => ({
    titleText: "",
    showTitle: false,
    headerRef: { current: null },
  }),
}));
vi.mock("../components/mobile-header-actions", () => ({
  MobileHeaderActionSlot: () => null,
}));
vi.mock("../components/profile-dialogs-provider", () => ({
  useProfileDialogs: () => ({
    openAddressDialog: vi.fn(),
    openPaymentPreferenceDialog: vi.fn(),
    openQrCodeDialog: vi.fn(),
  }),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ openAgreement: vi.fn() }),
}));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: ({ name }: { name: string }) => (
    <span data-illustration={name} />
  ),
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  navigation.pathname = "/orders";
  navigation.back.mockReset();
  navigation.replace.mockReset();
  navigation.redirect.mockReset();
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

async function back() {
  await act(async () => root.render(<MobileHeader />));
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="返回上一页"]')!
      .click(),
  );
}

describe("Pocket order navigation", () => {
  it("redirects the legacy standalone list to the primary orders Pocket tab", () => {
    PocketPage();
    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith(
      "/orders?tab=pocket",
    );
  });

  it.each([
    "/pocket/new",
    "/pocket/9001",
    "/pocket/9001/capture",
    "/pocket/9001/pay",
  ])(
    "returns a direct Pocket visit to orders when history is absent: %s",
    async (pathname) => {
      navigation.pathname = pathname;
      vi.spyOn(window.history, "length", "get").mockReturnValue(1);
      await back();
      expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(
        "/orders?tab=pocket",
      );
      expect(navigation.back).not.toHaveBeenCalled();
    },
  );

  it("preserves the previous activity when Pocket has navigation history", async () => {
    navigation.pathname = "/pocket/9001/pay";
    vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    await back();
    expect(navigation.back).toHaveBeenCalledOnce();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("keeps orders as a primary page without a secondary back header", async () => {
    navigation.pathname = "/orders";
    await act(async () => root.render(<MobileHeader />));
    expect(container.querySelector("header")).toBeNull();
  });

  it("keeps face enrollment in profile and removes the Pocket list shortcut", async () => {
    await act(async () =>
      root.render(<ProfileManagementClient feedbackFormUrl={null} />),
    );
    expect(
      container.querySelector('a[href="/profile/face"]')?.textContent,
    ).toContain("人脸录入");
    expect(
      container.querySelector('[data-illustration="face"]'),
    ).not.toBeNull();
    expect(container.querySelector('a[href="/pocket"]')).toBeNull();
    expect(container.textContent).not.toContain("我的 Pocket");
    expect(container.textContent).toContain("收款码");
  });
});
