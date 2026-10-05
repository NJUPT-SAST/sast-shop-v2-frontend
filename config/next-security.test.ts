import { afterEach, describe, expect, it, vi } from "vitest";
import { createSecurityHeaders } from "./next-security";

afterEach(() => vi.unstubAllEnvs());

describe("Next security headers", () => {
  it("allows the Feishu SDK's Function initialization in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = createSecurityHeaders({
      allowCamera: true,
      allowLarkSdk: true,
    });
    const policy = headers.find(
      (header) => header.key === "Content-Security-Policy",
    )!.value;
    const scriptPolicy = policy
      .split("; ")
      .find((directive) => directive.startsWith("script-src "))!;

    expect(scriptPolicy.split(" ")).toEqual([
      "script-src",
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://lf-scm-cn.feishucdn.com",
    ]);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).not.toContain("ws:");
    expect(policy).not.toContain("http://127.0.0.1:6660");
    expect(headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  });

  it("keeps production evaluation disabled when the SDK is not enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = createSecurityHeaders({ allowCamera: false });
    expect(
      headers.find((header) => header.key === "Content-Security-Policy")?.value,
    ).not.toContain("'unsafe-eval'");
  });

  it("retains development evaluation support without the SDK", () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = createSecurityHeaders({ allowCamera: true });
    expect(
      headers.find((header) => header.key === "Content-Security-Policy")?.value,
    ).toContain("'unsafe-eval'");
  });

  it.each([
    [true, "camera=(self), microphone=(), geolocation=()"],
    [false, "camera=(), microphone=(), geolocation=()"],
  ])(
    "sets the camera policy for allowCamera=%s",
    (allowCamera, expectedPolicy) => {
      const headers = createSecurityHeaders({ allowCamera });

      expect(
        headers.find((header) => header.key === "Permissions-Policy")?.value,
      ).toBe(expectedPolicy);
    },
  );
});
