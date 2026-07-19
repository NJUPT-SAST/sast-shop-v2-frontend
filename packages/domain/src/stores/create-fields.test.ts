import { describe, expect, it } from "vitest";

import { validateStoreCreateFields } from "./create-fields";

describe("store create field validation", () => {
  it.each([
    ["", "", { name: "required", address: "required" }],
    ["   ", "仙林校区", { name: "required" }],
    ["SAST 商店", "   ", { address: "required" }],
  ])("reports missing fields", (name, address, expectedErrors) => {
    expect(validateStoreCreateFields({ name, address })).toEqual({
      ok: false,
      errors: expectedErrors,
    });
  });

  it("returns normalized fields when both values are present", () => {
    expect(
      validateStoreCreateFields({
        name: "  SAST 商店  ",
        address: "  仙林校区大学生活动中心  ",
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: "SAST 商店",
        address: "仙林校区大学生活动中心",
      },
    });
  });
});
