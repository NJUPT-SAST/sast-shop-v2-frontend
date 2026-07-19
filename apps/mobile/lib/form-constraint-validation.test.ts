import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentsDirectory = resolve(import.meta.dirname, "../components");
const formComponents = [
  "store-create-dialog.tsx",
  "product-template-manager.tsx",
];

describe("mobile form constraint validation", () => {
  it.each(formComponents)("uses component validation in %s", (fileName) => {
    const source = readFileSync(resolve(componentsDirectory, fileName), "utf8");
    const formTags = source.match(/<form\b[\s\S]*?>/g) ?? [];

    expect(formTags.length).toBeGreaterThan(0);
    expect(formTags.every((formTag) => formTag.includes("noValidate"))).toBe(
      true,
    );
  });

  it("renders field errors instead of required constraints in store-create-dialog.tsx", () => {
    const source = readFileSync(
      resolve(componentsDirectory, "store-create-dialog.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\srequired(?:\s|\/?>)/);
    expect(source).toContain("<FieldError");
    expect(source).toContain("aria-invalid");
    expect(source).toContain("data-invalid");
  });
});
