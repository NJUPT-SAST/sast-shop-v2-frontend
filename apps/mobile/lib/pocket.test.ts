import { describe, expect, it } from "vitest";
import {
  AuthRequiredError,
  FeatureUnavailableError,
  ResourceNotFoundError,
} from "@sast-shop/api";
import {
  parsePocketAmount,
  pocketMoney,
  pocketError,
  validatePocketImage,
  pocketJobFinished,
} from "./pocket";

describe("West Pocket amount entry", () => {
  it("preserves every cent, including decimal values affected by binary rounding", () => {
    expect(parsePocketAmount("1.01")).toBe(101);
    expect(parsePocketAmount("0.29")).toBe(29);
    expect(parsePocketAmount(" 100.1 ")).toBe(10010);
    expect(parsePocketAmount("21474836.47")).toBe(2147483647);
    expect([3334, 3333, 3333].map(pocketMoney)).toEqual([
      "¥33.34",
      "¥33.33",
      "¥33.33",
    ]);
  });
  it.each([
    "0",
    "0.00",
    "-1",
    "1.001",
    "1e2",
    "NaN",
    "Infinity",
    "21474836.48",
    "1,000",
    "01",
    "",
  ])("rejects invalid or overflowing amount %s", (value) => {
    expect(() => parsePocketAmount(value)).toThrow();
  });
});

describe("West Pocket access and recovery", () => {
  it("shows actionable access/unavailable errors without raw service names", () => {
    expect(pocketError(new AuthRequiredError())).toContain("登录");
    expect(pocketError(new ResourceNotFoundError("secret"))).not.toContain(
      "secret",
    );
    expect(pocketError(new FeatureUnavailableError("rpc"))).toContain(
      "暂未开放",
    );
    expect(pocketError(new Error("token=secret"))).not.toContain("secret");
  });
  it("stops polling terminal jobs but leaves pending jobs recoverable", () => {
    expect(pocketJobFinished("failed")).toBe(true);
    expect(pocketJobFinished("succeeded")).toBe(true);
    expect(pocketJobFinished("running")).toBe(false);
  });
  it("rejects unsupported/oversized photos before upload", () => {
    expect(() =>
      validatePocketImage({ type: "image/webp", size: 100 }),
    ).toThrow();
    expect(() =>
      validatePocketImage({ type: "image/heic", size: 100 }),
    ).toThrow("HEIC");
    expect(() =>
      validatePocketImage({ type: "image/jpeg", size: 11 * 1024 * 1024 }),
    ).toThrow("10 MB");
    expect(() =>
      validatePocketImage({ type: "image/jpeg", size: 0 }),
    ).toThrow();
  });
});
