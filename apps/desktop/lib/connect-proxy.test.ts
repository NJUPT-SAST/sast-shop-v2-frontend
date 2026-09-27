import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/connect/[...path]/route";

const auth = vi.hoisted(() => ({ mode: "required", token: "session-token" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: auth.token }) }),
}));
vi.mock("@/lib/auth-mode", () => ({ getServerAuthMode: () => auth.mode }));
vi.mock("@/lib/server-service-options", () => ({
  getServerConnectBaseUrl: () => "http://backend.test/connect",
}));

vi.mock("@/lib/app-config", () => ({
  desktopAppConfig: { appOrigin: "https://shop.test" },
}));

async function requestPath(path: string[], origin = "https://shop.test") {
  const request = new NextRequest(
    "http://0.0.0.0:3002/api/connect/placeholder",
    {
      method: "POST",
      headers: {
        origin,
        host: "shop.test",
        "x-forwarded-host": "shop.test",
        "content-type": "application/json",
        "x-west-pocket-token": "forged-internal-token",
      },
      body: "{}",
    },
  );
  return POST(request, { params: Promise.resolve({ path }) });
}

describe.each(["required", "off"])("Connect proxy in %s auth mode", (mode) => {
  beforeEach(() => {
    auth.mode = mode;
    auth.token = "session-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}")),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["sast.sastshopv2.payment.v1.PaymentInternalService", "BatchGetBills"],
    ["sast.sastshopv2.payment.v1.PaymentInternalService", "CancelBillBySource"],
    ["sast.sastshopv2.westpocket.v1.WestPocketInternalService", "GetCollectionState"],
    ["sast.sastshopv2.user.v1.AuthService", "Login"],
    ["sast.sastshopv2.user.v1.AuthService", "GetJSAPIAuthConfig"],
    ["sast.sastshopv2.payment.v1.BillService", "UnknownMethod"],
    ["sast.sastshopv2.payment.v1.BillService%2FGetBill"],
    ["sast.sastshopv2.payment.v1.BillService/GetBill"],
    ["sast.sastshopv2.payment.v1.BillService", "GetBill%2fextra"],
    ["sast.sastshopv2.payment.v1.BillService", "GetBill", "extra"],
    ["..", "health"],
    [],
  ])("blocks non-public route %j", async (...path) => {
    const response = await requestPath(path);

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a public RPC while preserving session authentication", async () => {
    const response = await requestPath([
      "sast.sastshopv2.payment.v1.BillService",
      "GetBill",
    ]);

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe(
      "http://backend.test/connect/sast.sastshopv2.payment.v1.BillService/GetBill",
    );
    expect(new Headers(options?.headers).get("authorization")).toBe(
      mode === "required" ? "Bearer session-token" : null,
    );
    expect(new Headers(options?.headers).get("x-west-pocket-token")).toBeNull();
  });

  it("blocks internal methods even without a session", async () => {
    auth.token = "";
    const response = await requestPath([
      "sast.sastshopv2.payment.v1.PaymentInternalService",
      "BatchGetBills",
    ]);

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Connect proxy origin enforcement behind a reverse proxy", () => {
  beforeEach(() => {
    auth.mode = "required";
    auth.token = "session-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}")),
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    "https://attacker.test",
    "null",
    "",
    "http://shop.test",
    "https://shop.test/forged",
  ])("rejects Origin %s despite a trusted forwarded host", async (origin) => {
    const response = await requestPath(
      ["sast.sastshopv2.payment.v1.BillService", "GetBill"],
      origin,
    );
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
