import { describe, expect, it, vi } from "vitest";

import {
  readJsonResponseWithLimit,
  ResponseTooLargeError,
} from "./limited-json-response";

describe("readJsonResponseWithLimit", () => {
  it("parses JSON within the limit", async () => {
    const response = Response.json({ url: "https://cdn.example.test/a.webp" });

    await expect(readJsonResponseWithLimit(response, 1024)).resolves.toEqual({
      url: "https://cdn.example.test/a.webp",
    });
  });

  it("rejects an oversized declared response before reading", async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        cancel,
      }),
      { headers: { "content-length": "100" } },
    );

    await expect(
      readJsonResponseWithLimit(response, 10),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects an oversized streamed response", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(8));
          controller.enqueue(new Uint8Array(8));
          controller.close();
        },
      }),
    );

    await expect(
      readJsonResponseWithLimit(response, 10),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("preserves JSON parse errors", async () => {
    await expect(
      readJsonResponseWithLimit(new Response("not-json"), 100),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});
