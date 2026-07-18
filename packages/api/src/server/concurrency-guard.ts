export class ConcurrencyGuard {
  private activeTotal = 0;
  private readonly activeByKey = new Map<string, number>();

  constructor(
    private readonly maxTotal: number,
    private readonly maxPerKey: number,
  ) {
    if (
      !Number.isInteger(maxTotal) ||
      maxTotal < 1 ||
      !Number.isInteger(maxPerKey) ||
      maxPerKey < 1 ||
      maxPerKey > maxTotal
    ) {
      throw new Error("Invalid concurrency limits");
    }
  }

  tryAcquire(key: string): (() => void) | null {
    const activeForKey = this.activeByKey.get(key) ?? 0;
    if (this.activeTotal >= this.maxTotal || activeForKey >= this.maxPerKey) {
      return null;
    }

    this.activeTotal += 1;
    this.activeByKey.set(key, activeForKey + 1);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeTotal -= 1;

      const remainingForKey = (this.activeByKey.get(key) ?? 1) - 1;
      if (remainingForKey === 0) this.activeByKey.delete(key);
      else this.activeByKey.set(key, remainingForKey);
    };
  }
}
