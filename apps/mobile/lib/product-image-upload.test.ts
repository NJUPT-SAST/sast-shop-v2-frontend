// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadProductImage } from "./product-image-upload";

const image = new File(["image"], "product.png", { type: "image/png" });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("product image upload timeout", () => {
  it("aborts a hanging request and reports a retryable timeout", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return new Promise<Response>(() => {});
      }),
    );

    const upload = uploadProductImage(image);
    const outcome = expect(upload).rejects.toThrow("图片上传超时，请重试");
    await vi.advanceTimersByTimeAsync(30_000);

    await outcome;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also times out while reading the response body", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return {
          ok: true,
          json: () => new Promise<unknown>(() => {}),
        } as Response;
      }),
    );

    const upload = uploadProductImage(image);
    const outcome = expect(upload).rejects.toThrow("图片上传超时，请重试");
    await vi.advanceTimersByTimeAsync(30_000);

    await outcome;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timer after a successful upload", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return {
          ok: true,
          json: async () => ({ url: "https://example.test/product.png" }),
        } as Response;
      }),
    );

    await expect(uploadProductImage(image)).resolves.toBe(
      "https://example.test/product.png",
    );
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(signal?.aborted).toBe(false);
  });
});
