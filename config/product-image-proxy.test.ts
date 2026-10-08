import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyProductImage } from "../server/product-image";

const filename = `${"a".repeat(64)}.png`;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const maximumImageBytes = 10 * 1024 * 1024;

function upstreamImage(
  bytes: Uint8Array = png,
  headers: HeadersInit = { "content-type": "image/png" },
) {
  return new Response(new Uint8Array(bytes), { headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("product image proxy", () => {
  it.each([
    "https://backend.example.test/connect/",
    "http://127.0.0.1:6660/connect/",
  ])(
    "fetches only the fixed product path from the configured origin %s",
    async (baseUrl) => {
      const fetchImage = vi.fn().mockResolvedValue(upstreamImage());
      vi.stubGlobal("fetch", fetchImage);

      const response = await proxyProductImage(filename, baseUrl);

      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
      const [url, options] = fetchImage.mock.calls[0]!;
      expect(String(url)).toBe(
        `${new URL(baseUrl).origin}/images/sast-shop/products/${filename}`,
      );
      expect(options.method).toBe("GET");
      expect(options.redirect).toBe("manual");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      const requestHeaders = new Headers(options.headers);
      expect(requestHeaders.has("cookie")).toBe(false);
      expect(requestHeaders.has("authorization")).toBe(false);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=86400, immutable",
      );
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    },
  );

  it.each([
    `../${filename}`,
    `${"A".repeat(64)}.png`,
    `${"a".repeat(63)}.png`,
    `${filename}?url=https://untrusted.example.test/private`,
    `${filename}#private`,
    `${"a".repeat(64)}.svg`,
    `https://untrusted.example.test/${filename}`,
    `%2f${filename}`,
  ])(
    "rejects a filename that could select another resource: %s",
    async (value) => {
      const fetchImage = vi.fn();
      vi.stubGlobal("fetch", fetchImage);
      expect(
        (await proxyProductImage(value, "https://backend.example.test")).status,
      ).toBe(404);
      expect(fetchImage).not.toHaveBeenCalled();
    },
  );

  it.each([
    "invalid",
    "file:///etc/passwd",
    "https://user:secret@backend.example.test",
    "https://user@backend.example.test",
    "https://backend.example.test?token=secret",
    "https://backend.example.test#private",
  ])("rejects unsafe backend configuration: %s", async (baseUrl) => {
    const fetchImage = vi.fn();
    vi.stubGlobal("fetch", fetchImage);
    expect((await proxyProductImage(filename, baseUrl)).status).toBe(502);
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it.each([301, 302, 307, 308, 401, 403, 500])(
    "does not follow or expose an upstream %s response",
    async (status) => {
      const fetchImage = vi.fn().mockResolvedValue(
        new Response(null, {
          status,
          headers: {
            location: "http://127.0.0.1/private",
            "set-cookie": "private=value",
          },
        }),
      );
      vi.stubGlobal("fetch", fetchImage);
      const response = await proxyProductImage(
        filename,
        "https://backend.example.test",
      );
      expect(response.status).toBe(502);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.has("location")).toBe(false);
      expect(response.headers.has("set-cookie")).toBe(false);
      expect(fetchImage).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves a missing image response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    expect(
      (await proxyProductImage(filename, "https://backend.example.test"))
        .status,
    ).toBe(404);
  });

  it.each([
    new Error("network failure"),
    new DOMException("timeout", "TimeoutError"),
  ])("returns an uncached failure when fetching fails", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    const response = await proxyProductImage(
      filename,
      "https://backend.example.test",
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    "text/html",
    "image/svg+xml",
    "image/gif",
    "application/octet-stream",
    "",
  ])("rejects unsupported upstream content type %s", async (mimeType) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(upstreamImage(png, { "content-type": mimeType })),
    );
    expect(
      (await proxyProductImage(filename, "https://backend.example.test"))
        .status,
    ).toBe(502);
  });

  it.each(["image/png", "image/jpeg", "image/webp"])(
    "rejects falsely declared %s images",
    async (mimeType) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            upstreamImage(
              new TextEncoder().encode("<html>not an image</html>"),
              { "content-type": mimeType },
            ),
          ),
      );
      expect(
        (await proxyProductImage(filename, "https://backend.example.test"))
          .status,
      ).toBe(502);
    },
  );

  it.each([
    ["jpg", "image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
    ["jpeg", "image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
    [
      "webp",
      "image/webp",
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ]),
    ],
  ])("serves validated %s images", async (extension, mimeType, bytes) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamImage(bytes as Uint8Array, {
          "content-type": `${mimeType}; charset=binary`,
        }),
      ),
    );
    const response = await proxyProductImage(
      `${"a".repeat(64)}.${extension}`,
      "https://backend.example.test",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(mimeType);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("rejects oversized content before consuming its body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: {
            "content-type": "image/png",
            "content-length": String(maximumImageBytes + 1),
          },
        }),
      ),
    );
    expect(
      (await proxyProductImage(filename, "https://backend.example.test"))
        .status,
    ).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("caps a streamed image even when its content length understates its size", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maximumImageBytes));
        controller.enqueue(new Uint8Array([1]));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-type": "image/png", "content-length": "8" },
        }),
      ),
    );
    expect(
      (await proxyProductImage(filename, "https://backend.example.test"))
        .status,
    ).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects an interrupted body", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("connection interrupted"));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-type": "image/png" },
        }),
      ),
    );
    expect(
      (await proxyProductImage(filename, "https://backend.example.test"))
        .status,
    ).toBe(502);
  });

  it("rejects an empty successful image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(upstreamImage(new Uint8Array())),
    );
    expect(
      (await proxyProductImage(filename, "https://backend.example.test"))
        .status,
    ).toBe(502);
  });
});
