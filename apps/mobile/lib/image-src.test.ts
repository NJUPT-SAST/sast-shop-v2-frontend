import { describe, expect, it } from "vitest";

import { sanitizeImageSrc } from "./image-src";

describe("sanitizeImageSrc", () => {
  it("keeps supported image URL forms", () => {
    expect(sanitizeImageSrc("https://example.test/a.png")).toBe(
      "https://example.test/a.png",
    );
    expect(sanitizeImageSrc("http://example.test/a.png")).toBe(
      "http://example.test/a.png",
    );
    expect(sanitizeImageSrc("/images/a.png")).toBe("/images/a.png");
    expect(sanitizeImageSrc("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(sanitizeImageSrc("blob:http://localhost:3001/abc")).toBe(
      "blob:http://localhost:3001/abc",
    );
  });

  it("drops generated prose and relative paths before the browser requests them", () => {
    expect(sanitizeImageSrc("After 11 iterations, he edify the place.")).toBe(
      null,
    );
    expect(sanitizeImageSrc("products/a.png")).toBe(null);
    expect(sanitizeImageSrc("   ")).toBe(null);
    expect(sanitizeImageSrc(null)).toBe(null);
  });
});
