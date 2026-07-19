import { describe, expect, it, vi } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("limits active work and preserves input order", async () => {
    let active = 0;
    let peak = 0;

    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return value * 2;
      },
    );

    expect(peak).toBeLessThanOrEqual(3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("does not call the mapper for an empty list", async () => {
    const mapper = vi.fn();
    await expect(mapWithConcurrency([], 2, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it("rejects an invalid concurrency limit", async () => {
    await expect(
      mapWithConcurrency([1], 0, async (value) => value),
    ).rejects.toThrow("并发上限");
  });

  it("rejects when a mapper fails", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (value) => {
        if (value === 2) throw new Error("store lookup failed");
        return value;
      }),
    ).rejects.toThrow("store lookup failed");
  });

  it("does not schedule more work after a mapper fails", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstInFlight = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started: number[] = [];

    const result = mapWithConcurrency([0, 1, 2, 3], 2, async (value) => {
      started.push(value);
      if (value === 0) await firstInFlight;
      if (value === 1) throw new Error("store lookup failed");
      return value;
    });

    await vi.waitFor(() => expect(started).toEqual([0, 1]));
    releaseFirst?.();
    await expect(result).rejects.toThrow("store lookup failed");
    expect(started).toEqual([0, 1]);
  });
});
