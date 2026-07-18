import { describe, expect, it, vi } from "vitest";
import {
  parseFormDataWithLimit,
  PayloadTooLargeError,
} from "./limited-form-data";

function streamingRequest(
  chunks: Uint8Array[],
  headers: HeadersInit = {},
  onCancel = vi.fn(),
) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel: onCancel,
  });

  return {
    request: new Request("https://shop.example.test/upload", {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    onCancel,
  };
}

describe("parseFormDataWithLimit", () => {
  it("rejects an oversized chunked body and cancels the stream", async () => {
    const { request, onCancel } = streamingRequest([
      new Uint8Array(4),
      new Uint8Array(4),
    ]);

    await expect(parseFormDataWithLimit(request, 6)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("rejects when the actual body exceeds a smaller declared length", async () => {
    const { request } = streamingRequest(
      [new Uint8Array(3), new Uint8Array(3)],
      { "content-length": "2" },
    );

    await expect(parseFormDataWithLimit(request, 5)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("rejects an oversized declared length before reading", async () => {
    const pull = vi.fn();
    const request = new Request("https://shop.example.test/upload", {
      method: "POST",
      headers: { "content-length": "10" },
      body: new ReadableStream({ pull }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseFormDataWithLimit(request, 5)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
    expect(request.bodyUsed).toBe(false);
  });

  it("parses a multipart body whose size equals the limit", async () => {
    const original = new FormData();
    original.set(
      "picture",
      new File(["image"], "item.png", { type: "image/png" }),
    );
    const encoded = new Request("https://shop.example.test/upload", {
      method: "POST",
      body: original,
    });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const request = new Request(encoded.url, {
      method: "POST",
      headers: { "content-type": encoded.headers.get("content-type") ?? "" },
      body: bytes,
    });

    const parsed = await parseFormDataWithLimit(request, bytes.byteLength);
    expect(parsed.get("picture")).toBeInstanceOf(File);
  });

  it("preserves multipart parse errors", async () => {
    const request = new Request("https://shop.example.test/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=missing" },
      body: "invalid",
    });

    await expect(
      parseFormDataWithLimit(request, 100),
    ).rejects.not.toBeInstanceOf(PayloadTooLargeError);
  });
});
