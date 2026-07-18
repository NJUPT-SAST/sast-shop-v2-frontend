import { describe, expect, it } from "vitest";

import { getProvinceOptions } from "./mainland-address-regions";

describe("mainland address regions", () => {
  it("only returns mainland province-level regions", () => {
    const provinceLabels = getProvinceOptions().map((option) => option.label);

    expect(provinceLabels).toContain("江苏省");
    expect(provinceLabels).not.toContain("台湾省");
    expect(provinceLabels).not.toContain("香港特别行政区");
    expect(provinceLabels).not.toContain("澳门特别行政区");
  });
});
