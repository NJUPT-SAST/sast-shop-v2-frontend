import { describe, expect, it } from "vitest";

import { LoginExchangeGuard } from "./login-exchange-guard";

describe("LoginExchangeGuard", () => {
  it("limits bursts and refills tokens over time", () => {
    const guard = new LoginExchangeGuard(2, 1, 2, 1_000);
    const first = guard.tryAcquire(1_000);
    const second = guard.tryAcquire(1_000);
    if (first.allowed) first.release();
    if (second.allowed) second.release();

    expect(guard.tryAcquire(1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(guard.tryAcquire(2_000).allowed).toBe(true);
  });

  it("limits concurrent exchanges and releases slots idempotently", () => {
    const guard = new LoginExchangeGuard(10, 1, 1, 1_000);
    const permit = guard.tryAcquire(1_000);

    expect(permit.allowed).toBe(true);
    expect(guard.tryAcquire(1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    if (!permit.allowed) throw new Error("expected a permit");
    permit.release();
    permit.release();
    expect(guard.tryAcquire(1_000).allowed).toBe(true);
  });

  it("rejects invalid rate limit configuration", () => {
    expect(() => new LoginExchangeGuard(0, 1, 1)).toThrow();
    expect(() => new LoginExchangeGuard(1, 0, 1)).toThrow();
  });
});
