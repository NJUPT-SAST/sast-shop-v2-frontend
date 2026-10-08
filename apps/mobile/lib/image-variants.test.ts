import { describe, expect, it } from "vitest";
import {
  imageOptimizationSrc,
  imageThumbnailSrc,
} from "@workspace/ui/lib/image-variants";

const filename = `${"a".repeat(64)}.png`;
const source = `https://api.sast.fun/images/sast-shop/products/${filename}`;

describe("product image optimization sources", () => {
  it("uses the same-origin product image endpoint for stored images", () => {
    const localSrc = `/api/images/products/${filename}`;
    expect(imageOptimizationSrc(source)).toBe(localSrc);
    const query = new URL(imageThumbnailSrc(source), "https://shop.sast.fun")
      .searchParams;
    expect(query.get("url")).toBe(localSrc);
    expect(query.get("w")).toBe("64");
  });

  it.each([
    source.replace("api.sast.fun", "evil.example"),
    source.replace("api.sast.fun", "api.sast.fun.evil.example"),
    source.replace("https:", "http:"),
    source.replace("api.sast.fun", "user:password@api.sast.fun"),
    `${source}?signature=private`,
    `${source}#fragment`,
    source.replace(filename, "unknown.png"),
    source.replace(filename, `${"a".repeat(64)}.svg`),
    "/brand/help.webp",
    "blob:https://shop.sast.fun/local-upload",
  ])(
    "preserves other sources instead of redirecting them to the backend: %s",
    (src) => {
      expect(imageOptimizationSrc(src)).toBe(src);
    },
  );
});
