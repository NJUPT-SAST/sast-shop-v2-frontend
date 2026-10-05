import { describe, expect, it } from "vitest";
import { hasTrustedRequestOrigin } from "./request-origin";

const appOrigin = "https://shop.example.test";

describe("trusted request origin", () => {
  it.each([
    [appOrigin, appOrigin],
    [appOrigin, `${appOrigin}/`],
    ["http://localhost:3001", "http://localhost:3001"],
    ["http://127.0.0.1:3002", "http://127.0.0.1:3002"],
  ])("accepts %s for configured origin %s", (origin, configured) => {
    expect(hasTrustedRequestOrigin(new Headers({ origin }), configured)).toBe(
      true,
    );
  });

  it.each([
    "https://shop-pc.example.test",
    "http://shop.example.test",
    "https://shop.example.test:3001",
    "https://shop.example.test.attacker.test",
    "https://attacker.test",
    "null",
    "",
    "invalid-origin",
    `${appOrigin}/`,
    `${appOrigin}/page`,
    `${appOrigin}?query=1`,
    `${appOrigin}#fragment`,
    "https://user:password@shop.example.test",
    `blob:${appOrigin}/id`,
    `${appOrigin} https://attacker.test`,
    `${appOrigin}, https://attacker.test`,
  ])("rejects Origin %s even with a trusted Referer", (origin) => {
    const headers = new Headers({ origin, referer: `${appOrigin}/profile` });
    expect(hasTrustedRequestOrigin(headers, appOrigin)).toBe(false);
  });

  it("accepts a trusted Referer only when Origin is absent", () => {
    const headers = new Headers({ referer: `${appOrigin}/orders?view=buyer` });
    expect(hasTrustedRequestOrigin(headers, appOrigin)).toBe(true);
  });

  it.each([
    "https://attacker.test/page",
    "https://user:password@shop.example.test/page",
    `blob:${appOrigin}/id`,
    "invalid-referer",
    "",
  ])("rejects Referer %s", (referer) => {
    expect(hasTrustedRequestOrigin(new Headers({ referer }), appOrigin)).toBe(
      false,
    );
  });

  it("does not use host or forwarded headers as a trust source", () => {
    const headers = new Headers({
      host: "shop.example.test",
      "x-forwarded-host": "shop.example.test",
      "x-forwarded-proto": "https",
      forwarded: "host=shop.example.test;proto=https",
    });
    expect(hasTrustedRequestOrigin(headers, appOrigin)).toBe(false);
    headers.set("origin", "https://attacker.test");
    expect(hasTrustedRequestOrigin(headers, appOrigin)).toBe(false);
  });

  it.each([
    "",
    "not-a-url",
    "ftp://shop.example.test",
    "https://user:password@shop.example.test",
    `${appOrigin}/page`,
    `${appOrigin}?query=1`,
    `${appOrigin}#fragment`,
  ])("fails closed for invalid configured origin %s", (configured) => {
    expect(
      hasTrustedRequestOrigin(new Headers({ origin: appOrigin }), configured),
    ).toBe(false);
  });
});
