import { describe, expect, it } from "vitest";

import {
  createErrandDemandSnapshot,
  normalizeErrandDemandSnapshot,
  shouldDisplayErrandDemandExpired,
} from "./errand-demand-snapshot";

const productTemplate = {
  id: "1001",
  title: "SAST 贴纸",
  description: "社团周边",
  priceCents: 1599,
  storeId: "3001",
  mainImageUrl: "https://example.test/sticker.png",
  barcode: "690000000001",
  updatedAt: "2026-07-18T08:00:00.000Z",
};

describe("errand demand snapshots", () => {
  it("keeps the demand fields needed to edit a previous request", () => {
    const snapshot = createErrandDemandSnapshot({
      demandId: "9001",
      storeId: "3001",
      deadline: "2026-07-18T14:00:00.000Z",
      createdAt: "2026-07-18T09:00:00.000Z",
      items: [
        {
          productTemplate,
          quantity: 2,
          serviceFeePerUnitCents: 300,
        },
      ],
    });

    expect(snapshot).toEqual({
      demandId: "9001",
      storeId: "3001",
      deadline: "2026-07-18T14:00:00.000Z",
      createdAt: "2026-07-18T09:00:00.000Z",
      items: [
        {
          productTemplate,
          quantity: 2,
          serviceFeePerUnitCents: 300,
        },
      ],
    });
  });

  it("normalizes persisted snapshots and drops malformed item rows", () => {
    expect(
      normalizeErrandDemandSnapshot({
        demandId: "9001",
        storeId: "3001",
        deadline: "2026-07-18T14:00:00Z",
        createdAt: "2026-07-18T09:00:00Z",
        items: [
          {
            productTemplate,
            quantity: 2,
            serviceFeePerUnitCents: 300,
          },
          {
            productTemplate,
            quantity: 0,
            serviceFeePerUnitCents: 300,
          },
        ],
      }),
    ).toEqual({
      demandId: "9001",
      storeId: "3001",
      deadline: "2026-07-18T14:00:00.000Z",
      createdAt: "2026-07-18T09:00:00.000Z",
      items: [
        {
          productTemplate,
          quantity: 2,
          serviceFeePerUnitCents: 300,
        },
      ],
    });
  });

  it("marks active demand states expired after the deadline only", () => {
    const now = new Date("2026-07-18T15:00:00.000Z");
    const deadline = "2026-07-18T14:00:00.000Z";

    expect(shouldDisplayErrandDemandExpired("open", deadline, now)).toBe(true);
    expect(
      shouldDisplayErrandDemandExpired("distributing", deadline, now),
    ).toBe(true);
    expect(shouldDisplayErrandDemandExpired("completed", deadline, now)).toBe(
      false,
    );
    expect(
      shouldDisplayErrandDemandExpired(
        "open",
        deadline,
        new Date("2026-07-18T13:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
