import { ConcurrencyGuard } from "./concurrency-guard";

export type LoginExchangePermit =
  | { allowed: true; release: () => void }
  | { allowed: false; retryAfterSeconds: number };

export class LoginExchangeGuard {
  private tokens: number;
  private updatedAt: number;
  private readonly concurrency: ConcurrencyGuard;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    maxConcurrency: number,
    now = Date.now(),
  ) {
    if (
      !Number.isFinite(capacity) ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      !Number.isFinite(refillPerSecond) ||
      refillPerSecond <= 0
    ) {
      throw new Error("Invalid login exchange rate limits");
    }
    this.tokens = capacity;
    this.updatedAt = now;
    this.concurrency = new ConcurrencyGuard(maxConcurrency, maxConcurrency);
  }

  tryAcquire(now = Date.now()): LoginExchangePermit {
    const elapsedSeconds = Math.max(0, now - this.updatedAt) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSeconds * this.refillPerSecond,
    );
    this.updatedAt = Math.max(this.updatedAt, now);

    if (this.tokens < 1) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((1 - this.tokens) / this.refillPerSecond),
        ),
      };
    }

    const release = this.concurrency.tryAcquire("oauth");
    if (!release) return { allowed: false, retryAfterSeconds: 1 };

    this.tokens -= 1;
    return { allowed: true, release };
  }
}

export const loginExchangeGuard = new LoginExchangeGuard(20, 1, 8);
