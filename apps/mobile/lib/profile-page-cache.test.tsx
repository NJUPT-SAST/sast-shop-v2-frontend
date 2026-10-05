// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { AuthRequiredError } from "@sast-shop/api";
import { ProfilePageClient } from "../components/profile-page-client";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getCurrentUser,
}));
vi.mock("../components/profile-management", () => ({
  ProfileManagement: () => <div>资料管理</div>,
}));

const user = { id: "2048", name: "当前登录同学", avatarUrl: "" };
let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
const props = {
  dataSource: "local" as const,
  connectBaseUrl: "http://localhost:3001/api/connect",
  feedbackFormUrl: null,
  authRequired: true,
};

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  getCurrentUser.mockReset().mockResolvedValue(user);
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ authenticated: true, user }),
  });
  vi.stubGlobal("fetch", fetchMock);
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

async function render(refreshKey: string, authRequired = true) {
  await act(async () =>
    root.render(
      <ProfilePageClient
        {...props}
        authRequired={authRequired}
        refreshKey={refreshKey}
      />,
    ),
  );
}

describe("mobile profile memory cache", () => {
  it("keeps the logged-in user across long visits, focus, and unrelated writes", async () => {
    let now = 100_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await render("visit-1");
    await act(async () => root.render(null));
    now += 24 * 60 * 60_000;
    await render("visit-2");
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("sast-shop:data-changed"));
    });
    expect(container.textContent).toContain(user.name);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("clears the prior user during a login switch and loads the new session user", async () => {
    await render("visit-1");
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changing")),
    );
    expect(container.textContent).not.toContain(user.name);
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: { ...user, id: "4096", name: "新的登录同学" },
      }),
    });
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changed")),
    );
    expect(container.textContent).toContain("新的登录同学");
    expect(container.textContent).not.toContain(user.name);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears a previously cached user immediately when manual refresh finds an expired session", async () => {
    await render("visit-1");
    const dispatch = vi.spyOn(window, "dispatchEvent");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false, user: null }),
    });
    await render("refresh-1");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: AuthRequiredError.browserEventName }),
    );
    expect(container.textContent).not.toContain(user.name);
    expect(container.textContent).toContain("资料加载失败");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("uses the authenticated session user and reuses it after navigating back", async () => {
    await render("visit-1");
    expect(container.textContent).toContain(user.name);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      cache: "no-store",
    });
    await act(async () => root.render(null));
    await render("visit-2");
    expect(container.textContent).toContain(user.name);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes on a same-mounted router refresh and preserves the old profile while waiting", async () => {
    await render("visit-1");
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    await render("refresh-1");
    expect(container.textContent).toContain(user.name);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          user: { ...user, name: "更新后的同学" },
        }),
      });
    });
    expect(container.textContent).toContain("更新后的同学");
  });

  it("does not replace an expired authenticated session with the local smoke user", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false, user: null }),
    });
    await render("visit-1");
    expect(container.textContent).toContain("资料加载失败");
    expect(container.textContent).not.toContain(user.name);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("keeps auth-off local data available through the API facade", async () => {
    await render("visit-1", false);
    expect(getCurrentUser).toHaveBeenCalledWith({
      dataSource: props.dataSource,
      connectBaseUrl: props.connectBaseUrl,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain(user.name);
  });
});
