import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  resolve(process.cwd(), "app/api/auth/session/route.ts"),
  "utf8",
);
const serviceOptionsSource = readFileSync(
  resolve(process.cwd(), "lib/server-service-options.ts"),
  "utf8",
);

describe("mobile OAuth session source", () => {
  it("binds the OAuth user to the session and clears both cookies", () => {
    expect(routeSource).toContain("createSessionUserCookie(");
    expect(routeSource).toContain("readSessionUserCookie(");
    expect(routeSource).toContain("getSessionCookieSecret()");
    expect(routeSource).toContain("Boolean(sessionToken && user)");
    expect(routeSource).toContain(
      "cookieStore.set(sessionUserCookieName, sessionUserCookie, cookieOptions)",
    );
    expect(routeSource).toContain(
      'cookieStore.set(sessionUserCookieName, "", expiredCookieOptions)',
    );
  });

  it("passes only the verified OAuth user to authenticated services", () => {
    expect(serviceOptionsSource).toContain("readSessionUserCookie(");
    expect(serviceOptionsSource).toContain("getSessionCookieSecret()");
    expect(serviceOptionsSource).toContain(
      "currentUser: currentUser ?? undefined",
    );
    expect(serviceOptionsSource).toContain("requiresAuthenticatedUser: true");
  });
});
