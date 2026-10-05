// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRequiredError } from "@sast-shop/api";
import { AuthBootstrap } from "../components/auth-bootstrap";
import Home from "../app/page";

const {
  refresh,
  replace,
  validateSessionUser,
  waitForLarkReady,
  requestLarkAuthorizationCode,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  validateSessionUser: vi.fn(),
  waitForLarkReady: vi.fn(),
  requestLarkAuthorizationCode: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh, replace }),
  usePathname: () => "/shop",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  validateSessionUser,
  waitForLarkReady,
  requestLarkAuthorizationCode,
}));

const currentSession = {
  ok: true,
  status: 200,
  json: async () => ({ authenticated: true, user: { id: "10001" } }),
};
const missingSession = {
  ok: true,
  status: 200,
  json: async () => ({ authenticated: false, user: null }),
};
let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("h5sdk", undefined);
  vi.stubGlobal("tt", undefined);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
  );
  fetchMock = vi.fn().mockResolvedValue(currentSession);
  vi.stubGlobal("fetch", fetchMock);
  refresh.mockReset();
  replace.mockReset();
  validateSessionUser.mockReset().mockResolvedValue(undefined);
  waitForLarkReady.mockReset().mockResolvedValue(undefined);
  requestLarkAuthorizationCode.mockReset().mockResolvedValue("auth-code");
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

async function renderBootstrap(
  enabled = true,
  children = <div data-testid="app-content">商城内容</div>,
  redirectUri?: string,
) {
  await act(async () =>
    root.render(
      <AuthBootstrap
        enabled={enabled}
        appId="cli_test"
        redirectUri={redirectUri}
        dataSource="local"
        connectBaseUrl="http://127.0.0.1:1323"
      >
        {children}
      </AuthBootstrap>,
    ),
  );
}

describe("mobile auth bootstrap client gate", () => {
  it("keeps the home URL until authorization and session creation finish", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", {});
    let authorize!: (code: string) => void;
    requestLarkAuthorizationCode.mockImplementation(
      () => new Promise<string>((resolve) => (authorize = resolve)),
    );
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(missingSession)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue(currentSession);

    await renderBootstrap(true, <Home />);
    expect(requestLarkAuthorizationCode).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);

    await act(async () => authorize("auth-code"));
    expect(replace).toHaveBeenCalledWith("/shop");
  });

  it("does not leave the home URL when authorization fails", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", {});
    fetchMock.mockResolvedValue(missingSession);
    requestLarkAuthorizationCode.mockRejectedValue(
      new Error("invalid redirect uri"),
    );

    await renderBootstrap(true, <Home />);
    expect(container.textContent).toContain("invalid redirect uri");
    expect(replace).not.toHaveBeenCalled();
  });

  it("uses the configured root before SDK authorization on a deep link", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", {});
    fetchMock.mockResolvedValue(missingSession);
    const locationReplace = vi.fn();
    const originalWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(originalWindow, {
        get(target, key) {
          if (key === "location")
            return {
              href: "http://localhost:3000/orders?view=buyer",
              replace: locationReplace,
            };
          return Reflect.get(target, key, target);
        },
      }),
    );
    await renderBootstrap(true, undefined, "http://localhost:3000/");
    expect(locationReplace).toHaveBeenCalledWith(
      "http://localhost:3000/?returnTo=%2Forders%3Fview%3Dbuyer",
    );
    expect(requestLarkAuthorizationCode).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });

  it("keeps an existing session on its current page despite root configuration", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    await renderBootstrap(true, undefined, "https://other.example.test/");
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
    expect(requestLarkAuthorizationCode).not.toHaveBeenCalled();
  });

  it("does not enforce the configured entry when authentication is disabled", async () => {
    await renderBootstrap(false, undefined, "https://other.example.test/");
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks an ordinary browser before checking an existing valid session", async () => {
    await renderBootstrap();
    expect(container.querySelector('[data-testid="app-content"]')).toBeNull();
    expect(container.textContent).toMatch(/请在飞书.*打开/);
    expect(container.querySelector("button")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(validateSessionUser).not.toHaveBeenCalled();
  });

  it("keeps mock preview available outside Feishu when auth is disabled", async () => {
    await renderBootstrap(false);
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes the login retry when the client environment becomes unsupported", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    fetchMock.mockResolvedValue(missingSession);
    await renderBootstrap();
    expect(container.textContent).toContain("重新登录");
    const callsBeforeChange = fetchMock.mock.calls.length;

    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Safari/604.1",
    );
    await act(async () => window.dispatchEvent(new Event("focus")));

    expect(container.textContent).toContain("请在飞书中打开应用");
    expect(container.querySelector("button")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeChange);
    expect(requestLarkAuthorizationCode).not.toHaveBeenCalled();
  });

  it("allows an existing session in a native UA before the SDK is ready", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    await renderBootstrap();
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
    expect(validateSessionUser).toHaveBeenCalledWith("10001", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
  });

  it("authenticates inside Feishu with a CDN SDK that has no browser field", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    const sdk = { ready: vi.fn((callback: () => void) => callback()) };
    vi.stubGlobal("h5sdk", sdk);
    vi.stubGlobal("tt", {});
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(missingSession)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue(currentSession);

    await renderBootstrap();
    expect(waitForLarkReady).toHaveBeenCalledWith(sdk);
    expect(requestLarkAuthorizationCode).toHaveBeenCalledWith(
      window.tt,
      "cli_test",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
  });

  it("distinguishes a native SDK loading delay and retries after script load", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(missingSession)
      .mockResolvedValueOnce(missingSession)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue(currentSession);
    await renderBootstrap();
    expect(container.querySelector('[data-testid="app-content"]')).toBeNull();
    expect(container.textContent).toContain("飞书登录组件尚未就绪，请稍后重试");

    const script = document.createElement("script");
    document.head.append(script);
    const sdk = { ready: vi.fn((callback: () => void) => callback()) };
    await act(async () => {
      vi.stubGlobal("h5sdk", sdk);
      vi.stubGlobal("tt", {});
      script.dispatchEvent(new Event("load"));
    });
    script.remove();
    expect(waitForLarkReady).toHaveBeenCalledWith(sdk);
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
  });

  it("blocks recovery without clearing the session after the UA leaves Feishu", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    await renderBootstrap();
    const callsBeforeExpiry = fetchMock.mock.calls.length;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Chrome/140.0",
    );
    await act(async () =>
      window.dispatchEvent(new Event(AuthRequiredError.browserEventName)),
    );
    expect(container.querySelector('[data-testid="app-content"]')).toBeNull();
    expect(container.textContent).toContain("请在飞书中打开应用");
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeExpiry);
  });

  it("keeps the successful session recovery cooldown", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", {});
    fetchMock.mockImplementation(
      async (_url: string, options?: { method?: string }) =>
        options?.method ? { ok: true, status: 200 } : currentSession,
    );
    await renderBootstrap();
    await act(async () =>
      window.dispatchEvent(new Event(AuthRequiredError.browserEventName)),
    );
    await act(async () =>
      window.dispatchEvent(new Event(AuthRequiredError.browserEventName)),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([, options]) => options?.method === "DELETE",
      ),
    ).toHaveLength(1);
  });
});
