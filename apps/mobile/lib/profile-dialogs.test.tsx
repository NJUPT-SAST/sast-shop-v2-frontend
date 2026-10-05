// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProfileDialogsProvider,
  useProfileDialogs,
} from "../components/profile-dialogs-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useRouter: () => ({
    replace: (href: string) => window.history.replaceState(null, "", href),
  }),
}));

// Keep the real provider, API requests and controls; omit portal/animation behavior.
vi.mock("@workspace/ui/components/responsive-dialog", () => {
  const Content = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveDialog: ({
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
          <button onClick={() => onOpenChange(false)}>关闭抽屉</button>
        </div>
      ) : null,
    ResponsiveDialogContent: Content,
    ResponsiveDialogDescription: Content,
    ResponsiveDialogFooter: Content,
    ResponsiveDialogHeader: Content,
    ResponsiveDialogTitle: Content,
  };
});

const qrPath = "/sast.sastshopv2.payment.v1.QrCodeService/GetQrCode";
const addressPath = "/sast.sastshopv2.user.v1.AddressService/GetAddress";
const qrCode = {
  id: "2001",
  channel: "CHANNEL_WECHAT",
  content: "wxp://current-user",
};

function Menu() {
  const { openQrCodeDialog, openAddressDialog } = useProfileDialogs();
  return (
    <>
      <button onClick={openQrCodeDialog}>打开收款码</button>
      <button onClick={openAddressDialog}>打开地址簿</button>
    </>
  );
}

let container: HTMLDivElement;
let root: Root;
let requests: { path: string; body: unknown }[];
let qrResponse: () => Response;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/profile");
  requests = [];
  qrResponse = () => jsonResponse({ qrCodes: [qrCode] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      // Only inspect the payload; Node Request cannot consume jsdom's AbortSignal.
      const request = new Request(input, { ...init, signal: undefined });
      const path = new URL(request.url).pathname;
      requests.push({ path, body: JSON.parse(await request.text()) });
      if (path === qrPath) return qrResponse();

      // Real users need neither the smoke user 10001 nor a working address service
      // to manage their QR codes.
      return jsonResponse({ code: "internal", message: "unavailable" }, 500);
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderProvider() {
  await act(async () => {
    root.render(
      <ProfileDialogsProvider
        dataSource="local"
        connectBaseUrl="http://localhost"
        overview={null}
        error={null}
      >
        <Menu />
      </ProfileDialogsProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.textContent === label,
  );
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

describe("profile drawer loading", () => {
  it("loads only the authenticated user's QR codes when opening 收款码", async () => {
    await renderProvider();
    expect(requests).toEqual([]);
    await click("打开收款码");

    expect(requests).toEqual([{ path: qrPath, body: {} }]);
    expect(
      container.querySelector('[aria-label="更改微信支付收款码"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="上传支付宝收款码"]'),
    ).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps both upload controls available when no QR codes are saved", async () => {
    qrResponse = () => jsonResponse({});
    await renderProvider();
    await click("打开收款码");

    expect(
      container.querySelector('[aria-label="上传微信支付收款码"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="上传支付宝收款码"]'),
    ).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("loads QR codes after an address failure without sharing the error state", async () => {
    await renderProvider();
    await click("打开地址簿");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await click("关闭抽屉");
    await click("打开收款码");

    expect(requests).toEqual([
      { path: addressPath, body: {} },
      { path: qrPath, body: {} },
    ]);
    expect(
      container.querySelector('[aria-label="更改微信支付收款码"]'),
    ).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows genuine QR failures and retries only the QR request", async () => {
    qrResponse = () =>
      jsonResponse({ code: "unavailable", message: "offline" }, 503);
    await renderProvider();
    await click("打开收款码");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="上传微信支付收款码"]'),
    ).toBeNull();

    qrResponse = () => jsonResponse({ qrCodes: [qrCode] });
    await click("重新加载");

    expect(requests).toEqual([
      { path: qrPath, body: {} },
      { path: qrPath, body: {} },
    ]);
    expect(
      container.querySelector('[aria-label="更改微信支付收款码"]'),
    ).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
