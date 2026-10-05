import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readSessionUserCookie,
  sessionCookieName,
  sessionUserCookieName,
} from "@sast-shop/api/server";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  cookieStore: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@sast-shop/api", () => ({ loginWithLarkCode: mocks.login }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("@/lib/app-config", () => ({
  desktopAppConfig: {
    appOrigin: "https://shop-pc.example.test",
    dataSource: "local",
  },
}));
vi.mock("@/lib/auth-mode", () => ({ getServerAuthMode: () => "required" }));
vi.mock("@/lib/server-service-options", () => ({
  getServerConnectBaseUrl: () => "https://backend.example.test",
}));

import {
  POST as createSession,
  DELETE as clearSession,
  GET as readSession,
} from "@/app/api/auth/session/route";
import { POST as proxyConnect } from "@/app/api/connect/[...path]/route";
import { POST as uploadImage } from "@/app/api/uploads/product-image/route";

const appOrigin = "https://shop-pc.example.test";
const secret = "test-session-cookie-secret-at-least-32-bytes";
const cookieStore = mocks.cookieStore;
const upstream = vi.fn<typeof fetch>();

function request(
  path: string,
  origin = appOrigin,
  body = "{}",
  method = "POST",
) {
  return new NextRequest(`http://internal-app:3002${path}`, {
    method,
    headers: {
      origin,
      referer: `${appOrigin}/profile`,
      "content-type": "application/json",
      host: "shop-pc.example.test",
      "x-forwarded-host": "shop-pc.example.test",
      "x-forwarded-proto": "https",
    },
    body: method === "DELETE" ? undefined : body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue(undefined);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SESSION_COOKIE_SECRET", secret);
  vi.stubGlobal("fetch", upstream);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("session origin behind a reverse proxy", () => {
  it("passes the configured public origin through to code validation", async () => {
    const response = await createSession(request("/api/auth/session"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid authorization code",
    });
    expect(mocks.login).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("establishes a signed session and reads it back after RPC code exchange", async () => {
    const user = { id: "test-user", name: "测试用户", avatarUrl: "" };
    mocks.login.mockResolvedValueOnce({
      user,
      sessionToken: "test-session",
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const response = await createSession(
      request(
        "/api/auth/session",
        appOrigin,
        JSON.stringify({ code: "test-code" }),
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.login).toHaveBeenCalledWith(
      "test-code",
      expect.objectContaining({
        connectBaseUrl: "https://backend.example.test",
        dataSource: "local",
      }),
    );
    const savedCookies = response.cookies.getAll().map((cookie) => cookie);
    expect(savedCookies).toHaveLength(2);
    for (const cookie of savedCookies) {
      expect(cookie).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
    }
    const signedUser = savedCookies.find(
      (cookie) => cookie.name === sessionUserCookieName,
    )?.value;
    expect(
      await readSessionUserCookie(signedUser, "test-session", secret),
    ).toEqual(user);
    cookieStore.get.mockImplementation((name: string) =>
      savedCookies.find((cookie) => cookie.name === name),
    );
    const restored = await readSession();
    expect(await restored.json()).toEqual({ authenticated: true, user });
  });

  it("rejects foreign Origin without RPC or cookie writes even with spoofed headers", async () => {
    const response = await createSession(
      request(
        "/api/auth/session",
        "https://attacker.test",
        JSON.stringify({ code: "test-code" }),
      ),
    );
    expect(response.status).toBe(403);
    expect(mocks.login).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears a session from the public origin", async () => {
    const response = await clearSession(
      request("/api/auth/session", appOrigin, "", "DELETE"),
    );
    expect(response.status).toBe(200);
    const savedCookies = response.cookies.getAll().map((cookie) => cookie);
    expect(savedCookies.map((cookie) => cookie.name).sort()).toEqual(
      [sessionCookieName, sessionUserCookieName].sort(),
    );
    expect(
      savedCookies.every(
        (cookie) => cookie.value === "" && Number(cookie.expires) === 0,
      ),
    ).toBe(true);
  });

  it("rejects foreign logout without clearing cookies", async () => {
    const response = await clearSession(
      request("/api/auth/session", "https://attacker.test", "", "DELETE"),
    );
    expect(response.status).toBe(403);
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

const path = ["sast.sastshopv2.user.v1.UserService", "GetCurrentUser"];
const context = () => ({ params: Promise.resolve({ path }) });

describe("authenticated proxy origin", () => {
  it("requires a session before forwarding", async () => {
    expect(
      (await proxyConnect(request("/api/connect/user"), context())).status,
    ).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards the configured origin with only the server session credential", async () => {
    cookieStore.get.mockReturnValue({ value: "test-session" });
    upstream.mockResolvedValueOnce(Response.json({ user: "test-user" }));
    const req = request("/api/connect/user");
    req.headers.set("authorization", "Bearer untrusted-client-token");
    req.headers.set("cookie", "untrusted=value");
    const response = await proxyConnect(req, context());
    expect(response.status).toBe(200);
    const [url, options] = upstream.mock.calls[0]!;
    expect(String(url)).toBe("https://backend.example.test/" + path.join("/"));
    const headers = new Headers(options?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-session");
    for (const name of [
      "cookie",
      "host",
      "x-forwarded-host",
      "x-forwarded-proto",
    ])
      expect(headers.has(name)).toBe(false);
  });

  it("rejects foreign Origin without calling upstream", async () => {
    cookieStore.get.mockReturnValue({ value: "test-session" });
    const response = await proxyConnect(
      request("/api/connect/user", "https://attacker.test"),
      context(),
    );
    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(["Login", "GetJSAPIAuthConfig"])(
    "keeps %s inaccessible through the client proxy",
    async (method) => {
      cookieStore.get.mockReturnValue({ value: "test-session" });
      const response = await proxyConnect(request("/api/connect/auth"), {
        params: Promise.resolve({
          path: ["sast.sastshopv2.user.v1.AuthService", method],
        }),
      });
      expect(response.status).toBe(404);
      expect(upstream).not.toHaveBeenCalled();
    },
  );
});

describe("product image upload origin", () => {
  it("requires authentication after accepting the configured origin", async () => {
    expect(
      (await uploadImage(request("/api/uploads/product-image"))).status,
    ).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects foreign uploads without calling upstream", async () => {
    cookieStore.get.mockReturnValue({ value: "test-session" });
    expect(
      (
        await uploadImage(
          request("/api/uploads/product-image", "https://attacker.test"),
        )
      ).status,
    ).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("uploads a valid image from the public origin despite an internal request URL", async () => {
    cookieStore.get.mockReturnValue({ value: "test-session" });
    const form = new FormData();
    form.append(
      "picture",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "test.png",
        { type: "image/png" },
      ),
    );
    upstream.mockResolvedValueOnce(
      Response.json({ url: "https://cdn.example.test/test.png" }),
    );
    const req = new NextRequest(
      "http://internal-app:3002/api/uploads/product-image",
      { method: "POST", headers: { origin: appOrigin }, body: form },
    );
    const response = await uploadImage(req);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://cdn.example.test/test.png",
    });
    const [url, options] = upstream.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://backend.example.test/api/uploads/product-image",
    );
    expect(new Headers(options?.headers).get("authorization")).toBe(
      "Bearer test-session",
    );
  });
});
