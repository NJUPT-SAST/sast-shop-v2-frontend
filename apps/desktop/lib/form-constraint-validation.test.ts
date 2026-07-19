import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentsDirectory = resolve(import.meta.dirname, "../components");
const formComponents = ["store-create-dialog.tsx"];

describe("desktop form constraint validation", () => {
  it.each(formComponents)("uses component validation in %s", (fileName) => {
    const source = readFileSync(resolve(componentsDirectory, fileName), "utf8");
    const formTags = source.match(/<form\b[\s\S]*?>/g) ?? [];

    expect(formTags.length).toBeGreaterThan(0);
    expect(formTags.every((formTag) => formTag.includes("noValidate"))).toBe(
      true,
    );
  });

  it.each(formComponents)(
    "renders field errors instead of required constraints in %s",
    (fileName) => {
      const source = readFileSync(
        resolve(componentsDirectory, fileName),
        "utf8",
      );

      expect(source).not.toMatch(/\srequired(?:\s|\/?>)/);
      expect(source).toContain("<FieldError");
      expect(source).toContain("aria-invalid");
      expect(source).toContain("data-invalid");
    },
  );
});
