import { describe, expect, it } from "vitest";
import { parseConnectHealthUrl } from "./connect-health-url";

describe("CONNECT_HEALTH_URL", () => {
  it.each([undefined, "", "   "])("rejects a missing value (%j)", (value) => {
    expect(() => parseConnectHealthUrl(value)).toThrow();
  });

  it.each([
    "http://connect.example.test/health",
    "ftp://connect.example.test/health",
  ])("rejects a non-HTTPS URL: %s", (value) => {
    expect(() => parseConnectHealthUrl(value)).toThrow();
  });

  it.each([
    "https://deploy:secret@connect.example.test/health",
    "https://deploy@connect.example.test/health",
  ])("rejects embedded credentials: %s", (value) => {
    expect(() => parseConnectHealthUrl(value)).toThrow();
  });

  it.each([
    "https://connect.example.test/health?token=secret",
    "https://connect.example.test/health#ready",
  ])("rejects query strings and fragments: %s", (value) => {
    expect(() => parseConnectHealthUrl(value)).toThrow();
  });

  it("normalizes and returns a valid HTTPS health URL", () => {
    expect(
      parseConnectHealthUrl("  https://connect.example.test/health/ready  "),
    ).toBe("https://connect.example.test/health/ready");
  });
});
