import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessError } from "@sast-shop/api";
import { POST } from "../app/api/admin/connect/[...path]/route";

const state = vi.hoisted(() => ({ requireAdmin: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/admin-server", () => ({ requireAdmin: state.requireAdmin }));
vi.mock("@/lib/app-config", () => ({
  desktopAppConfig: { appOrigin: "https://shop.test" },
}));
const path = ["sast.sastshopv2.admin.v1.SpotAdminService", "MutateRecord"];
function send(origin = "https://shop.test", target = path, body = "{}") {
  return POST(
    new NextRequest("https://shop.test/api/admin/connect/path", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        authorization: "Bearer forged",
        cookie: "forged",
        "x-dev-user-id": "1",
        "x-west-pocket-token": "internal-forged",
        "x-admin-internal-token": "admin-internal-forged",
      },
      body,
    }),
    { params: Promise.resolve({ path: target }) },
  );
}
beforeEach(() => {
  state.requireAdmin.mockReset();
  state.fetch.mockReset();
  state.fetch.mockResolvedValue(
    new Response("{}", {
      headers: {
        "content-type": "application/json",
        "set-cookie": "leak=1",
        "access-control-allow-origin": "*",
      },
    }),
  );
  state.requireAdmin.mockResolvedValue({
    identity: { role: "admin" },
    options: { connectBaseUrl: "https://backend.test", fetch: state.fetch },
  });
});
describe("management proxy", () => {
  it("rejects unlisted methods before inspecting or forwarding the session", async () => {
    expect(
      (await send("https://shop.test", [path[0], "DeleteEverything"])).status,
    ).toBe(404);
    expect(state.requireAdmin).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin write", async () => {
    expect((await send("https://evil.test")).status).toBe(403);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("rechecks live authorization on every request and stops a revoked admin", async () => {
    expect((await send()).status).toBe(200);
    state.requireAdmin.mockRejectedValueOnce(
      new AdminAccessError(403, "已撤权"),
    );
    expect((await send()).status).toBe(403);
    expect(state.requireAdmin).toHaveBeenCalledTimes(2);
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not forward client credentials, dev bypass headers, or upstream cookies", async () => {
    const result = await send();
    const headers = new Headers(state.fetch.mock.calls[0][1].headers);
    for (const name of [
      "authorization",
      "cookie",
      "x-dev-user-id",
      "x-west-pocket-token",
      "x-admin-internal-token",
    ])
      expect(headers.has(name)).toBe(false);
    expect(result.headers.get("set-cookie")).toBeNull();
    expect(result.headers.get("access-control-allow-origin")).toBeNull();
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("limits request bodies before forwarding", async () => {
    expect(
      (await send("https://shop.test", path, "x".repeat(1024 * 1024 + 1)))
        .status,
    ).toBe(413);
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
