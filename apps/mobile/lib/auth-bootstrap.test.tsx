// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRequiredError } from "@sast-shop/api";
import { AuthBootstrap } from "../components/auth-bootstrap";
import Home from "../app/page";

const { refresh, replace, validateSessionUser, requestLarkAuthorizationCode } =
  vi.hoisted(() => ({
    refresh: vi.fn(),
    replace: vi.fn(),
    validateSessionUser: vi.fn(),
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
let locationAssign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  locationAssign = vi.fn();
  const originalWindow = window;
  const location = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "assign") return locationAssign;
        const value = Reflect.get(
          originalWindow.location,
          key,
          originalWindow.location,
        );
        return typeof value === "function"
          ? value.bind(originalWindow.location)
          : value;
      },
    },
  );
  vi.stubGlobal(
    "window",
    new Proxy(originalWindow, {
      get(target, key) {
        if (key === "location") return location;
        return Reflect.get(target, key, target);
      },
    }),
  );
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
  appId = "cli_test",
) {
  await act(async () =>
    root.render(
      <AuthBootstrap
        enabled={enabled}
        appId={appId}
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
  it("opens the configured app with the current deep link and retains a manual link", async () => {
    window.history.replaceState(null, "", "/orders/spot/42?view=buyer#bill");
    const targetHref = window.location.href;
    await renderBootstrap();
    expect(locationAssign).toHaveBeenCalledOnce();
    const link = container.querySelector<HTMLAnchorElement>("a");
    expect(link?.textContent).toBe("在飞书中打开");
    const appLink = new URL(link!.href);
    expect(appLink.origin + appLink.pathname).toBe(
      "https://applink.feishu.cn/client/web_app/open",
    );
    expect(appLink.searchParams.get("appId")).toBe("cli_test");
    expect(appLink.searchParams.get("lk_target_url")).toBe(targetHref);
    expect(locationAssign).toHaveBeenCalledWith(link!.href);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the manual link after returning or remounting in the same tab", async () => {
    await renderBootstrap();
    await act(async () => root.unmount());
    root = createRoot(container);
    window.history.replaceState(null, "", "/shop?view=seller");
    await renderBootstrap();
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(locationAssign).toHaveBeenCalledOnce();
    const link = container.querySelector<HTMLAnchorElement>("a");
    expect(link).not.toBeNull();
    expect(new URL(link!.href).searchParams.get("lk_target_url")).toBe(
      window.location.href,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["getItem", "setItem"] as const)(
    "keeps manual opening available when session storage %s fails",
    async (method) => {
      vi.spyOn(
        Object.getPrototypeOf(window.sessionStorage),
        method,
      ).mockImplementation(() => {
        throw new DOMException("Storage is disabled", "SecurityError");
      });
      await renderBootstrap();
      expect(locationAssign).not.toHaveBeenCalled();
      expect(container.querySelector("a")?.textContent).toBe("在飞书中打开");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not launch without an app ID and displays a recoverable configuration message", async () => {
    await renderBootstrap(true, undefined, undefined, " ");
    expect(locationAssign).not.toHaveBeenCalled();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("应用暂时无法打开，请联系管理员");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not launch from a Feishu UA while the SDK is still loading", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    await renderBootstrap();
    expect(locationAssign).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
  });

  it("does not launch a local preview with authentication disabled", async () => {
    await renderBootstrap(false);
    expect(locationAssign).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
  });

  it("opens only once when StrictMode replays mount effects", async () => {
    await act(async () =>
      root.render(
        <React.StrictMode>
          <AuthBootstrap
            enabled
            appId="cli_test"
            dataSource="local"
            connectBaseUrl="http://localhost/api/connect"
          >
            <div>商城内容</div>
          </AuthBootstrap>
        </React.StrictMode>,
      ),
    );
    expect(locationAssign).toHaveBeenCalledOnce();
    expect(container.querySelector("a")?.textContent).toBe("在飞书中打开");
  });

  it("checks the initial session once and merges concurrent focus probes", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    await renderBootstrap();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(validateSessionUser).toHaveBeenCalledOnce();
    let finish!: (response: typeof currentSession) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("sast-shop:probe-session"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => finish(currentSession));
    expect(validateSessionUser).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale session probe after recovery starts", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
    await renderBootstrap();
    let finish!: (response: typeof missingSession) => void;
    fetchMock.mockImplementation(
      async (_url: string, options?: { method?: string }) =>
        options?.method
          ? { ok: true, status: 200 }
          : new Promise((resolve) => {
              finish = resolve;
            }),
    );
    await act(async () => window.dispatchEvent(new Event("focus")));
    await act(async () =>
      window.dispatchEvent(new Event(AuthRequiredError.browserEventName)),
    );
    await act(async () => finish(missingSession));
    expect(requestLarkAuthorizationCode).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
    expect(
      fetchMock.mock.calls.filter(
        ([, options]) => options?.method === "DELETE",
      ),
    ).toHaveLength(1);
  });

  it("invalidates private caches only when the validated session user changes", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const changes = () =>
      dispatch.mock.calls.filter(
        ([event]) => event.type === "sast-shop:session-changed",
      );
    await renderBootstrap();
    expect(changes()).toHaveLength(1);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(changes()).toHaveLength(1);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, user: { id: "20002" } }),
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(validateSessionUser).toHaveBeenLastCalledWith("20002", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:1323",
    });
    expect(changes()).toHaveLength(2);
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
  });

  it("pauses private caches during recovery and resumes them only after a new session is created", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
    let authorize!: (code: string) => void;
    requestLarkAuthorizationCode.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          authorize = resolve;
        }),
    );
    fetchMock.mockImplementation(
      async (_url: string, options?: { method?: string }) =>
        options?.method ? { ok: true, status: 200 } : currentSession,
    );
    const dispatch = vi.spyOn(window, "dispatchEvent");
    await renderBootstrap();
    dispatch.mockClear();

    await act(async () =>
      window.dispatchEvent(new Event(AuthRequiredError.browserEventName)),
    );
    expect(
      dispatch.mock.calls.some(
        ([event]) => event.type === "sast-shop:session-changing",
      ),
    ).toBe(true);
    expect(
      dispatch.mock.calls.some(
        ([event]) => event.type === "sast-shop:session-changed",
      ),
    ).toBe(false);
    expect(container.querySelector('[data-testid="app-content"]')).toBeNull();

    await act(async () => authorize("new-auth-code"));
    expect(
      dispatch.mock.calls.some(
        ([event]) => event.type === "sast-shop:session-changed",
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "new-auth-code" }),
      }),
    );
    expect(
      container.querySelector('[data-testid="app-content"]'),
    ).not.toBeNull();
  });

  it("replaces the login entry with the requested page after authorization", async () => {
    const returnTo = "/orders?type=errand&view=buyer";
    window.history.replaceState(
      null,
      "",
      `/?returnTo=${encodeURIComponent(returnTo)}`,
    );
    const loginHref = window.location.href;
    const historyLength = window.history.length;
    replace.mockImplementation((href: string) => {
      window.history.replaceState(window.history.state, "", href);
    });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
    let authorize!: (code: string) => void;
    requestLarkAuthorizationCode.mockImplementation(
      () => new Promise<string>((resolve) => (authorize = resolve)),
    );
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(missingSession)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue(currentSession);

    try {
      await renderBootstrap(true, <Home />);
      expect(window.location.href).toBe(loginHref);
      expect(replace).not.toHaveBeenCalled();

      await act(async () => authorize("auth-code"));
      expect(replace).toHaveBeenCalledExactlyOnceWith(returnTo);
      expect(`${window.location.pathname}${window.location.search}`).toBe(
        returnTo,
      );
      expect(window.history.length).toBe(historyLength);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("keeps the home URL until authorization and session creation finish", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Lark/7.35.0",
    );
    vi.stubGlobal("h5sdk", { ready: vi.fn() });
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
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
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
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
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
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
    expect(locationAssign).not.toHaveBeenCalled();
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
    const sdk = { ready: vi.fn(), config: vi.fn() };
    vi.stubGlobal("h5sdk", sdk);
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(missingSession)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue(currentSession);

    await renderBootstrap();
    expect(sdk.ready).not.toHaveBeenCalled();
    expect(sdk.config).not.toHaveBeenCalled();
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
      vi.stubGlobal("tt", { requestAccess: vi.fn() });
      script.dispatchEvent(new Event("load"));
    });
    script.remove();
    expect(sdk.ready).not.toHaveBeenCalled();
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
    vi.stubGlobal("tt", { requestAccess: vi.fn() });
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
