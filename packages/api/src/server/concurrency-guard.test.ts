import { describe, expect, it } from "vitest";

import { ConcurrencyGuard } from "./concurrency-guard";

describe("ConcurrencyGuard", () => {
  it("enforces a per-key limit", () => {
    const guard = new ConcurrencyGuard(4, 2);
    const releaseFirst = guard.tryAcquire("user-a");
    const releaseSecond = guard.tryAcquire("user-a");

    expect(releaseFirst).toBeTypeOf("function");
    expect(releaseSecond).toBeTypeOf("function");
    expect(guard.tryAcquire("user-a")).toBeNull();

    releaseFirst?.();
    expect(guard.tryAcquire("user-a")).toBeTypeOf("function");
  });

  it("enforces a global limit across keys", () => {
    const guard = new ConcurrencyGuard(2, 2);

    expect(guard.tryAcquire("user-a")).toBeTypeOf("function");
    expect(guard.tryAcquire("user-b")).toBeTypeOf("function");
    expect(guard.tryAcquire("user-c")).toBeNull();
  });

  it("makes slot release idempotent", () => {
    const guard = new ConcurrencyGuard(1, 1);
    const release = guard.tryAcquire("user-a");

    release?.();
    release?.();

    expect(guard.tryAcquire("user-b")).toBeTypeOf("function");
    expect(guard.tryAcquire("user-c")).toBeNull();
  });

  it("rejects invalid limits", () => {
    expect(() => new ConcurrencyGuard(0, 1)).toThrow();
    expect(() => new ConcurrencyGuard(2, 3)).toThrow();
  });
});
