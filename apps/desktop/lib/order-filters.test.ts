import { describe, expect, it } from "vitest";

import {
  getOrderFiltersFromParams,
  updateOrderFilterParams,
} from "./order-filters";

describe("desktop order filters", () => {
  it("restores a valid errand captain view from the URL", () => {
    expect(
      getOrderFiltersFromParams(
        new URLSearchParams(
          "type=errand&view=captain&status=collecting_payment&q=%E4%BB%99%E6%9E%97",
        ),
      ),
    ).toEqual({
      type: "errand",
      view: "captain",
      status: "collecting_payment",
      query: "仙林",
    });
  });

  it("rejects a status that does not belong to the selected perspective", () => {
    expect(
      getOrderFiltersFromParams(
        new URLSearchParams(
          "type=errand&view=participant&status=collecting_payment",
        ),
      ),
    ).toEqual({
      type: "errand",
      view: "participant",
      status: "all",
      query: "",
    });
  });

  it("resets refinements when switching order type", () => {
    const params = updateOrderFilterParams(
      new URLSearchParams("view=seller&status=pending_payment&q=water"),
      {
        type: "errand",
        rememberedViews: { spot: "seller", errand: "captain" },
      },
    );

    expect(Object.fromEntries(params)).toEqual({
      type: "errand",
      view: "captain",
    });
  });
});
