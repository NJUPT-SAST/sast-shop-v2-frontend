// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileManagementClient } from "../components/profile-management-client";

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
  BrandIllustration: () => null,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("h5sdk", { ready: vi.fn(), config: vi.fn() });
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

async function renderAndClickFeedback() {
  const feedbackFormUrl = "https://njupt-sast.feishu.cn/share/base/form/test";
  await act(async () =>
    root.render(<ProfileManagementClient feedbackFormUrl={feedbackFormUrl} />),
  );
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
  return { defaultPrevented: click.defaultPrevented, assign, feedbackFormUrl };
}

describe("mobile profile feedback navigation", () => {
  it("uses Feishu navigation with a CDN SDK that has no browser field", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    const { defaultPrevented, assign, feedbackFormUrl } =
      await renderAndClickFeedback();
    expect(defaultPrevented).toBe(true);
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(feedbackFormUrl)}`,
    );
  });

  it("keeps the ordinary link behavior in a mobile browser", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
    );
    const { defaultPrevented, assign } = await renderAndClickFeedback();
    expect(defaultPrevented).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
