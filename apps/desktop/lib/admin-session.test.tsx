// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminSessionProvider,
  useAdminSession,
} from "../components/admin/admin-session";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/orders" }));
const identity = {
  id: "1",
  name: "管理员",
  role: "admin",
  status: "active",
  authVersion: "1",
  avatarUrl: "",
  capabilities: ["spot.manage"],
};
function Content() {
  const { identity } = useAdminSession();
  const [draft, setDraft] = React.useState("");
  return (
    <div data-testid="private">
      {identity.name}
      <input
        aria-label="待处理草稿"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}
let root: Root;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ identity }), {
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      <AdminSessionProvider>
        <Content />
      </AdminSessionProvider>,
    ),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
}
function result(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
describe("admin session recovery", () => {
  it("accepts a browser session without requiring the Feishu SDK", async () => {
    await render();
    expect(container.querySelector('[data-testid="private"]')).not.toBeNull();
  });
  it("hides management data after live revocation and does not start login loops", async () => {
    await render();
    fetchMock.mockResolvedValueOnce(result({ error: "已撤权" }, 403));
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:admin-access-changed")),
    );
    expect(container.querySelector('[data-testid="private"]')).toBeNull();
    expect(container.textContent).toContain("此账号没有后台访问权限");
    expect(
      fetchMock.mock.calls.every(([url]) => url === "/api/admin/session"),
    ).toBe(true);
  });
  it("remounts scoped management state when the auth version changes", async () => {
    await render();
    const previous = container.querySelector('[data-testid="private"]');
    fetchMock.mockResolvedValueOnce(
      result({ identity: { ...identity, authVersion: "2" } }),
    );
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(container.querySelector('[data-testid="private"]')).not.toBe(
      previous,
    );
  });
  it("fails closed when the role cannot be verified", async () => {
    fetchMock.mockResolvedValueOnce(result({ error: "服务不可用" }, 503));
    await render();
    expect(container.querySelector('[data-testid="private"]')).toBeNull();
    expect(container.textContent).toContain("服务不可用");
  });
});
