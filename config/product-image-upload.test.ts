import { describe, expect, it } from "vitest";
import {
  buildBackendProductImageUploadUrl,
  hasMatchingImageSignature,
  parseBackendImageUrl,
} from "./product-image-upload";

describe("backend product image upload URLs", () => {
  it.each([
    [
      "https://backend.example.test",
      "https://backend.example.test/api/uploads/product-image",
    ],
    [
      "https://backend.example.test/connect/",
      "https://backend.example.test/api/uploads/product-image",
    ],
    [
      "http://127.0.0.1:6660/",
      "http://127.0.0.1:6660/api/uploads/product-image",
    ],
  ])("builds the upload endpoint from %s", (baseUrl, expected) => {
    expect(buildBackendProductImageUploadUrl(baseUrl)).toBe(expected);
  });

  it.each([
    "https://deploy:secret@backend.example.test",
    "https://deploy@backend.example.test",
    "https://backend.example.test?token=secret",
    "https://backend.example.test#internal",
  ])("rejects an unsafe CONNECT_BASE_URL: %s", (baseUrl) => {
    expect(() => buildBackendProductImageUploadUrl(baseUrl)).toThrow();
  });

  it("accepts and normalizes an absolute HTTPS image URL", () => {
    expect(
      parseBackendImageUrl("  https://cdn.example.test/products/1.webp  "),
    ).toBe("https://cdn.example.test/products/1.webp");
  });

  it.each([
    "/products/1.webp",
    "data:image/png;base64,AAAA",
    "http://cdn.example.test/products/1.webp",
    "https://user:secret@cdn.example.test/products/1.webp",
  ])("rejects an unsafe production image URL: %s", (imageUrl) => {
    expect(parseBackendImageUrl(imageUrl)).toBeNull();
  });

  it("can allow an absolute HTTP image URL in development", () => {
    expect(
      parseBackendImageUrl("http://127.0.0.1:9000/products/1.webp", {
        allowHttp: true,
      }),
    ).toBe("http://127.0.0.1:9000/products/1.webp");
  });
});

describe("product image signatures", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    [
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ],
  ])("accepts a valid %s signature", (mimeType, bytes) => {
    expect(hasMatchingImageSignature(mimeType, new Uint8Array(bytes))).toBe(
      true,
    );
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "rejects spoofed %s content",
    (mimeType) => {
      expect(
        hasMatchingImageSignature(
          mimeType,
          new TextEncoder().encode("not-an-image"),
        ),
      ).toBe(false);
    },
  );
});
