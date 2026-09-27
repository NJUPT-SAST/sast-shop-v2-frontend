import { describe, expect, it } from "vitest";
import { hasExpectedRequestHost, isSameOriginRequest } from "./request-origin";

const appOrigin = "https://shop.test";

describe("configured request origin behind a reverse proxy", () => {
  it("accepts the preserved public Host without relying on forwarded headers", () => {
    const headers = new Headers({ host: "shop.test", origin: appOrigin });
    expect(isSameOriginRequest(headers, appOrigin)).toBe(true);
    headers.set("x-forwarded-host", "attacker.test");
    headers.set("x-forwarded-proto", "http");
    expect(isSameOriginRequest(headers, appOrigin)).toBe(true);
  });

  it("accepts a same-origin Referer only when Origin is absent", () => {
    const headers = new Headers({
      host: "shop.test",
      referer: `${appOrigin}/shop?x=1`,
    });
    expect(isSameOriginRequest(headers, appOrigin)).toBe(true);
    for (const origin of [
      "",
      "null",
      "https://attacker.test",
      `${appOrigin}/path`,
    ]) {
      headers.set("origin", origin);
      expect(isSameOriginRequest(headers, appOrigin)).toBe(false);
    }
  });

  it.each([
    "",
    "attacker.test",
    "shop.test:80",
    "shop.test.attacker.test",
    "shop.test,attacker.test",
    "shop.test/ignored",
    "user@shop.test",
  ])("rejects Host %s even with trusted-looking forwarded headers", (host) => {
    expect(
      isSameOriginRequest(
        new Headers({
          host,
          origin: appOrigin,
          "x-forwarded-host": "shop.test",
        }),
        appOrigin,
      ),
    ).toBe(false);
  });

  it.each([
    "http://shop.test",
    "https://shop.test:444",
    "null",
    "https://shop.test/path",
    "https://shop.test@attacker.test",
  ])("rejects a different or malformed Origin %s", (origin) => {
    expect(
      isSameOriginRequest(
        new Headers({ host: "shop.test", origin }),
        appOrigin,
      ),
    ).toBe(false);
  });

  it("normalizes the default Host port and supports configured development ports", () => {
    expect(
      hasExpectedRequestHost(new Headers({ host: "SHOP.test:443" }), appOrigin),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        new Headers({
          host: "localhost:3002",
          origin: "http://localhost:3002",
        }),
        "http://localhost:3002",
      ),
    ).toBe(true);
  });

  it.each([
    "invalid",
    "ftp://shop.test",
    "https://user@shop.test",
    "https://shop.test/path",
    "https://shop.test?x=1",
    "https://shop.test#x",
  ])("fails closed for invalid configured origin %s", (origin) => {
    expect(
      isSameOriginRequest(
        new Headers({ host: "shop.test", origin: appOrigin }),
        origin,
      ),
    ).toBe(false);
  });

  it("rejects missing source and Host headers", () => {
    expect(
      isSameOriginRequest(new Headers({ host: "shop.test" }), appOrigin),
    ).toBe(false);
    expect(
      isSameOriginRequest(new Headers({ origin: appOrigin }), appOrigin),
    ).toBe(false);
  });
});
