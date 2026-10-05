// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LarkContactButton } from "../components/lark-contact-button";

const { getSpotOrderSellerContact, getBuyerErrandOrderCaptainContact } =
  vi.hoisted(() => ({
    getSpotOrderSellerContact: vi.fn(),
    getBuyerErrandOrderCaptainContact: vi.fn(),
  }));

vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getSpotOrderSellerContact,
  getBuyerErrandOrderCaptainContact,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const signingConfig = {
  appId: "cli_test",
  timestamp: "1760000000",
  nonceStr: "nonce",
  signature: "signature",
};
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("h5sdk", undefined);
  vi.stubGlobal("tt", undefined);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
  );
  getSpotOrderSellerContact.mockReset();
  getBuyerErrandOrderCaptainContact.mockReset();
  vi.mocked(toast.error).mockReset();
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

async function renderContact(
  target: "spot-seller" | "errand-captain" = "spot-seller",
) {
  await act(async () =>
    root.render(
      <LarkContactButton
        target={target}
        orderId="5001"
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1323"
        label="联系卖家"
      />,
    ),
  );
}

function contactButton() {
  return container.querySelector<HTMLButtonElement>("button");
}

describe("mobile Lark contact button", () => {
  it("hides in an ordinary browser and shows for Feishu UA before the SDK loads", async () => {
    await renderContact();
    expect(contactButton()).toBeNull();

    await act(async () => {
      vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
      );
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(contactButton()?.textContent).toContain("联系卖家");

    await act(async () => contactButton()?.click());
    expect(toast.error).toHaveBeenCalledWith(
      "飞书联系组件尚未就绪，请稍后重试",
    );
    expect(getSpotOrderSellerContact).not.toHaveBeenCalled();
  });

  it("reveals the entry when a legacy SDK loads after mount", async () => {
    await renderContact();
    const script = document.createElement("script");
    document.head.append(script);
    await act(async () => {
      vi.stubGlobal("h5sdk", {
        browser: { versions: { mobileFeishu: true } },
      });
      script.dispatchEvent(new Event("load"));
    });
    script.remove();
    expect(contactButton()).not.toBeNull();
  });

  it("configures JSAPI and enters the seller chat once while the contact lookup is pending", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    let resolveContact!: (openId: string) => void;
    getSpotOrderSellerContact.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveContact = resolve;
      }),
    );
    const config = vi.fn((options: { onSuccess?: (value: unknown) => void }) =>
      options.onSuccess?.({}),
    );
    const ready = vi.fn((callback: () => void) => callback());
    const enterChat = vi.fn(
      (options: { openid: string; success: (value: unknown) => void }) =>
        options.success({}),
    );
    vi.stubGlobal("h5sdk", { ready, config });
    vi.stubGlobal("tt", { enterChat });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => signingConfig,
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderContact();

    await act(async () => {
      contactButton()?.click();
      contactButton()?.click();
    });
    expect(getSpotOrderSellerContact).toHaveBeenCalledExactlyOnceWith("5001", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => resolveContact(" ou_seller_1 "));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      `/api/auth/jsapi-config?url=${encodeURIComponent(window.location.href.split("#", 1)[0] ?? "")}`,
      { cache: "no-store" },
    );
    expect(ready).toHaveBeenCalledTimes(1);
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: 1760000000,
        jsApiList: ["tt.enterChat"],
      }),
    );
    expect(enterChat).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ openid: "ou_seller_1" }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not enter a chat when signing fails", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    getBuyerErrandOrderCaptainContact.mockResolvedValue("ou_captain_1");
    const config = vi.fn();
    const enterChat = vi.fn();
    vi.stubGlobal("h5sdk", { config });
    vi.stubGlobal("tt", { enterChat });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => null }),
    );
    await renderContact("errand-captain");
    await act(async () => contactButton()?.click());
    expect(getBuyerErrandOrderCaptainContact).toHaveBeenCalledExactlyOnceWith(
      "5001",
      { dataSource: "local", connectBaseUrl: "http://127.0.0.1:1323" },
    );
    expect(config).not.toHaveBeenCalled();
    expect(enterChat).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("联系功能暂不可用，请稍后再试");
  });
});
