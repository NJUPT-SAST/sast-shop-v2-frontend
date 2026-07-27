import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  resolve(process.cwd(), "app/api/auth/session/route.ts"),
  "utf8",
);
const sessionSource = readFileSync(
  resolve(process.cwd(), "lib/auth-session.ts"),
  "utf8",
);
const callbackSource = readFileSync(
  resolve(process.cwd(), "app/auth/callback/route.ts"),
  "utf8",
);
const serviceOptionsSource = readFileSync(
  resolve(process.cwd(), "lib/server-service-options.ts"),
  "utf8",
);

describe("desktop OAuth session source", () => {
  it("binds the OAuth user to the session and clears both cookies", () => {
    expect(sessionSource).toContain("createSessionUserCookie(");
    expect(routeSource).toContain("readSessionUserCookie(");
    expect(routeSource).toContain("getSessionCookieSecret()");
    expect(routeSource).toContain("Boolean(sessionToken && user)");
    expect(sessionSource).toContain(
      "response.cookies.set(\n    sessionUserCookieName,\n    sessionUserCookie,",
    );
    expect(sessionSource).toContain(
      'response.cookies.set(sessionUserCookieName, "", expiredCookieOptions)',
    );
  });

  it("guards desktop browser OAuth callback with state and redirect URI binding", () => {
    expect(callbackSource).toContain("state !== storedState");
    expect(callbackSource).toContain("isFreshFeishuOAuthState(parsedState)");
    expect(callbackSource).toContain("redirectUri: config.redirectUri");
    expect(callbackSource).toContain("setDesktopAuthSessionCookies(");
  });

  it("passes only the verified OAuth user to authenticated services", () => {
    expect(serviceOptionsSource).toContain("readSessionUserCookie(");
    expect(serviceOptionsSource).toContain("getSessionCookieSecret()");
    expect(serviceOptionsSource).toContain(
      "currentUser: currentUser ?? undefined",
    );
    expect(serviceOptionsSource).toContain(
      'getServerAuthMode() === "required"',
    );
  });
});
