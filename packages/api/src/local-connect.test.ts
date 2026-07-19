import { beforeEach, describe, expect, it, vi } from "vitest";

const { createConnectTransport } = vi.hoisted(() => ({
  createConnectTransport: vi.fn(() => ({ kind: "transport" })),
}));

vi.mock("@connectrpc/connect-web", () => ({ createConnectTransport }));

import { createLocalTransport } from "./local-connect";

describe("local Connect transport", () => {
  beforeEach(() => {
    createConnectTransport.mockClear();
  });

  it("applies a bounded default timeout", () => {
    const customFetch = vi.fn<typeof fetch>();

    createLocalTransport({
      connectBaseUrl: "https://backend.example.test",
      fetch: customFetch,
    });

    expect(createConnectTransport).toHaveBeenCalledWith({
      baseUrl: "https://backend.example.test",
      defaultTimeoutMs: 15_000,
      fetch: customFetch,
    });
  });
});
