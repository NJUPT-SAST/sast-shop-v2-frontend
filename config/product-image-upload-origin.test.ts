import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyProductImageUpload } from "../server/product-image-upload";

describe("image upload origin behind a reverse proxy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ["https://shop.test", 401],
    ["https://attacker.test", 403],
    ["null", 403],
  ])(
    "checks %s against the configured public origin before upload",
    async (origin, status) => {
      vi.stubGlobal("fetch", vi.fn());
      const response = await proxyProductImageUpload(
        new Request("http://0.0.0.0:3002/api/uploads/product-image", {
          method: "POST",
          headers: {
            host: "shop.test",
            origin,
            "x-forwarded-host": "shop.test",
          },
        }),
        {
          appOrigin: "https://shop.test",
          backendBaseUrl: "https://backend.test",
          isAuthenticationRequired: true,
        },
      );
      expect(response.status).toBe(status);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
