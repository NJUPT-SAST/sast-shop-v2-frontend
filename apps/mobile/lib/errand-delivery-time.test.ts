import { describe, expect, it } from "vitest";

import {
  getDefaultErrandDeadline,
  isValidErrandDeadline,
  toDateTimeLocalValue,
} from "./errand-delivery-time";

describe("errand delivery time", () => {
  it("defaults to today 22:00 before 20:00 when at least two hours away", () => {
    const now = new Date(2026, 5, 9, 10, 30);

    expect(toDateTimeLocalValue(getDefaultErrandDeadline(now))).toBe(
      "2026-06-09T22:00",
    );
  });

  it("defaults to tomorrow 22:00 at or after 20:00", () => {
    const now = new Date(2026, 5, 9, 20, 1);

    expect(toDateTimeLocalValue(getDefaultErrandDeadline(now))).toBe(
      "2026-06-10T22:00",
    );
  });

  it("uses tomorrow 22:00 when today 22:00 is too soon", () => {
    const now = new Date(2026, 5, 9, 21, 30);

    expect(toDateTimeLocalValue(getDefaultErrandDeadline(now))).toBe(
      "2026-06-10T22:00",
    );
  });

  it("validates deadlines at least two hours in the future", () => {
    const now = new Date(2026, 5, 9, 10, 0);

    expect(
      isValidErrandDeadline(new Date(2026, 5, 9, 11, 59), now),
    ).toBe(false);
    expect(
      isValidErrandDeadline(new Date(2026, 5, 9, 12, 0), now),
    ).toBe(true);
  });

  it("formats datetime-local values at local date and minute precision", () => {
    const date = new Date(2026, 5, 9, 10, 30, 45);

    expect(toDateTimeLocalValue(date)).toBe("2026-06-09T10:30");
  });
});
