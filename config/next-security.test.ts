import { describe, expect, it } from "vitest";
import { createSecurityHeaders } from "./next-security";

describe("Next security headers", () => {
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
