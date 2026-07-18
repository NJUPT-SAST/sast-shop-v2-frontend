import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(
  resolve(process.cwd(), "components/errand-demand-detail.tsx"),
  "utf8",
);

describe("errand demand detail source", () => {
  it("uses the shared Checkbox component instead of native checkbox inputs", () => {
    expect(detailSource).toContain("@workspace/ui/components/checkbox");
    expect(detailSource).not.toContain('type="checkbox"');
  });

  it("renders errand money values with distinct theme colors", () => {
    expect(detailSource).toContain("text-primary");
    expect(detailSource).toContain("text-service-fee");
  });
});
