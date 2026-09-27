import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST, DELETE } from "../app/api/auth/session/route";

vi.mock("@/lib/auth-session", () => ({
  createDesktopAuthSessionFromLarkCode: vi.fn(),
  setDesktopAuthSessionCookies: vi.fn(),
  clearDesktopAuthSessionCookies: () => {
    mocks.cookieSet();
    mocks.cookieSet();
  },
  LoginConfigurationError: class extends Error {},
  LoginRateLimitedError: class extends Error {},
}));

const mocks = vi.hoisted(() => ({ cookieSet: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("@/lib/auth-mode", () => ({ getServerAuthMode: () => "required" }));
vi.mock("@/lib/app-config", () => ({
  desktopAppConfig: { appOrigin: "https://shop.test" },
}));

function request(method: string, origin: string | null) {
  const headers = new Headers({
    host: "shop.test",
    "x-forwarded-host": "shop.test",
    "content-type": "application/json",
    referer: "https://shop.test/shop",
  });
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest("http://0.0.0.0:3002/api/auth/session", {
    method,
    headers,
    ...(method === "POST" ? { body: "{}" } : {}),
  });
}

describe("session origin checks behind a reverse proxy", () => {
  afterEach(() => vi.clearAllMocks());
  it.each(["https://shop.test", null])(
    "accepts public same-origin %s requests",
    async (origin) => {
      const response = await POST(request("POST", origin));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Invalid authorization code",
      });
      expect((await DELETE(request("DELETE", origin))).status).toBe(200);
      expect(mocks.cookieSet).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    "https://attacker.test",
    "http://shop.test",
    "null",
    "",
    "https://shop.test/path",
  ])(
    "rejects %s despite same-origin Referer and forwarded Host",
    async (origin) => {
      expect((await POST(request("POST", origin))).status).toBe(403);
      expect((await DELETE(request("DELETE", origin))).status).toBe(403);
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    },
  );
});
