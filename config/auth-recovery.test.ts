import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const apps = ["mobile", "desktop"] as const;

describe.each(apps)("%s authentication recovery wiring", (app) => {
  const bootstrap = readFileSync(
    resolve(root, `apps/${app}/components/auth-bootstrap.tsx`),
    "utf8",
  );
  const proxy = readFileSync(
    resolve(root, `apps/${app}/app/api/connect/[...path]/route.ts`),
    "utf8",
  );
  const sessionRoute = readFileSync(
    resolve(root, `apps/${app}/app/api/auth/session/route.ts`),
    "utf8",
  );

  it("serializes forced OAuth recovery after an unauthenticated event", () => {
    expect(bootstrap).toContain("AuthRequiredError.browserEventName");
    expect(bootstrap).toContain('method: "DELETE"');
    expect(bootstrap).toContain("if (!clearSession)");
    expect(bootstrap).toContain("recoveringRef.current");
  });

  it("bounds proxy requests without expiring a newer concurrent session", () => {
    expect(proxy).toContain("createConnectProxyAbort(request.signal)");
    expect(proxy).toContain('code: "deadline_exceeded"');
    expect(proxy).not.toContain("response.cookies.set");
  });

  it("guards OAuth exchanges with a retryable overload response", () => {
    expect(sessionRoute).toContain("loginExchangeGuard.tryAcquire()");
    expect(sessionRoute).toContain("permit.release()");
    expect(sessionRoute).toContain('"retry-after"');
    expect(sessionRoute).toContain("status: 429");
  });
});
