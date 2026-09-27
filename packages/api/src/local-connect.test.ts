import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createConnectTransport } = vi.hoisted(() => ({
  createConnectTransport: vi.fn(() => ({ kind: "transport" })),
}));

vi.mock("@connectrpc/connect-web", () => ({ createConnectTransport }));

import { Code, ConnectError } from "@connectrpc/connect";

import { AuthRequiredError, ResourceNotFoundError } from "./errors";
import { createLocalTransport, requestLocal } from "./local-connect";

describe("local Connect transport", () => {
  beforeEach(() => {
    createConnectTransport.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies a bounded default timeout", () => {
    const customFetch = vi.fn<typeof fetch>();

    createLocalTransport({
      connectBaseUrl: "https://backend.example.test",
      fetch: customFetch,
    });

    expect(createConnectTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://backend.example.test",
        defaultTimeoutMs: 15_000,
        fetch: customFetch,
      }),
    );
  });

  it("turns unauthenticated responses into an auth recovery signal", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    await expect(
      requestLocal("getCurrentUser", () =>
        Promise.reject(new ConnectError("expired", Code.Unauthenticated)),
      ),
    ).rejects.toBeInstanceOf(AuthRequiredError);
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: AuthRequiredError.browserEventName }),
    );
  });

  it("keeps not-found responses distinct from authentication failures", async () => {
    await expect(
      requestLocal("getStore", () =>
        Promise.reject(new ConnectError("missing", Code.NotFound)),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
