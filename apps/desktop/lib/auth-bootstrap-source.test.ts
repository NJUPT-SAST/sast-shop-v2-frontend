import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "components/auth-bootstrap.tsx"),
  "utf8",
);

describe("desktop auth bootstrap source", () => {
  it("uses the shared bounded Lark ready adapter", () => {
    expect(source).toContain("waitForLarkReady(sdk)");
    expect(source).not.toContain("new Promise<string>");
  });

  it("falls back to browser OAuth outside the Feishu client", () => {
    expect(source).toContain('"/api/auth/lark/authorize"');
    expect(source).toContain('"returnTo"');
    expect(source).toContain("window.location.assign(loginUrl.href)");
  });
});
