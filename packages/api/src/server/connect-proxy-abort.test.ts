import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONNECT_PROXY_TIMEOUT_MS,
  createConnectProxyAbort,
} from "./connect-proxy-abort";

describe("createConnectProxyAbort", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts at the shared 15 second deadline", () => {
    vi.useFakeTimers();
    const request = new AbortController();
    const upstream = createConnectProxyAbort(request.signal);

    vi.advanceTimersByTime(CONNECT_PROXY_TIMEOUT_MS - 1);
    expect(upstream.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(upstream.signal.aborted).toBe(true);
    expect(upstream.didTimeout()).toBe(true);
  });

  it("distinguishes caller cancellation from an upstream timeout", () => {
    vi.useFakeTimers();
    const request = new AbortController();
    const upstream = createConnectProxyAbort(request.signal);

    request.abort();

    expect(upstream.signal.aborted).toBe(true);
    expect(upstream.didTimeout()).toBe(false);
    upstream.dispose();
    vi.advanceTimersByTime(CONNECT_PROXY_TIMEOUT_MS);
    expect(upstream.didTimeout()).toBe(false);
  });

  it("disposes the timer after a successful response", () => {
    vi.useFakeTimers();
    const request = new AbortController();
    const upstream = createConnectProxyAbort(request.signal);

    upstream.dispose();
    vi.advanceTimersByTime(CONNECT_PROXY_TIMEOUT_MS);

    expect(upstream.signal.aborted).toBe(false);
  });
});
