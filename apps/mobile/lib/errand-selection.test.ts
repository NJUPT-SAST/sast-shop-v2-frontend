import { describe, expect, it } from "vitest";

import {
  calculateErrandSelectionTotals,
  getSelectableRequesterIds,
  toggleProductSelection,
  toggleRequesterSelection,
  type ErrandSelectionGroup,
} from "./errand-selection";

const groups: ErrandSelectionGroup[] = [
  {
    productId: "4001",
    estimatedUnitPriceCents: 200,
    requesters: [
      {
        errandDemandItemId: "9101",
        quantity: 6,
        serviceFeePerUnitCents: 50,
        updatedAt: "2026-06-10T06:05:00.000Z",
      },
      {
        errandDemandItemId: "9102",
        quantity: 6,
        serviceFeePerUnitCents: 50,
        updatedAt: "2026-06-10T06:06:00.000Z",
      },
    ],
  },
  {
    productId: "4002",
    estimatedUnitPriceCents: 1200,
    requesters: [
      {
        errandDemandItemId: "9103",
        quantity: 2,
        serviceFeePerUnitCents: 100,
        updatedAt: "2026-06-10T06:07:00.000Z",
      },
    ],
  },
];

const groupsWithStaleRequester: ErrandSelectionGroup[] = [
  {
    productId: "4003",
    estimatedUnitPriceCents: 500,
    requesters: [
      {
        errandDemandItemId: "9104",
        quantity: 3,
        serviceFeePerUnitCents: 25,
        updatedAt: "2026-06-10T06:08:00.000Z",
      },
      {
        errandDemandItemId: "9105",
        quantity: 10,
        serviceFeePerUnitCents: 50,
        updatedAt: null,
      },
      {
        errandDemandItemId: "9106",
        quantity: 1,
        serviceFeePerUnitCents: 75,
        updatedAt: "",
      },
    ],
  },
];

describe("errand selection helpers", () => {
  it("collects selectable requester row ids", () => {
    expect(getSelectableRequesterIds(groups)).toEqual(["9101", "9102", "9103"]);
  });

  it("toggles a single requester row", () => {
    const selectedIds = new Set(["9101"]);

    expect(toggleRequesterSelection(selectedIds, "9101")).toEqual(new Set());
    expect(toggleRequesterSelection(selectedIds, "9102")).toEqual(
      new Set(["9101", "9102"]),
    );
    expect(selectedIds).toEqual(new Set(["9101"]));
  });

  it("toggles all requester rows in a product group", () => {
    const selectedIds = new Set(["9101", "9102"]);

    expect(toggleProductSelection(new Set(), groups[0]!)).toEqual(
      new Set(["9101", "9102"]),
    );
    expect(toggleProductSelection(selectedIds, groups[0]!)).toEqual(new Set());
    expect(selectedIds).toEqual(new Set(["9101", "9102"]));
  });

  it("calculates totals from selected rows", () => {
    expect(
      calculateErrandSelectionTotals(groups, new Set(["9101", "9103"])),
    ).toEqual({
      selectedRowCount: 2,
      selectedQuantity: 8,
      productAmountCents: 3600,
      serviceFeeCents: 500,
      totalAmountCents: 4100,
    });
  });

  it("ignores selected rows that are not selectable", () => {
    expect(getSelectableRequesterIds(groupsWithStaleRequester)).toEqual([
      "9104",
    ]);
    expect(
      toggleProductSelection(new Set(), groupsWithStaleRequester[0]!),
    ).toEqual(new Set(["9104"]));
    expect(
      toggleProductSelection(
        new Set(["9105", "9106"]),
        groupsWithStaleRequester[0]!,
      ),
    ).toEqual(new Set(["9104", "9105", "9106"]));
    expect(
      calculateErrandSelectionTotals(
        groupsWithStaleRequester,
        new Set(["9104", "9105", "9106"]),
      ),
    ).toEqual({
      selectedRowCount: 1,
      selectedQuantity: 3,
      productAmountCents: 1500,
      serviceFeeCents: 75,
      totalAmountCents: 1575,
    });
  });
});
