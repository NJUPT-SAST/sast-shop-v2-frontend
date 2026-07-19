import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
const entrypoint = readFileSync(
  resolve(root, "docker/entrypoint.sh"),
  "utf8",
);
const publishWorkflow = readFileSync(
  resolve(root, ".github/workflows/publish.yml"),
  "utf8",
);

describe("optional feedback form deployment configuration", () => {
  it("does not require a feedback URL while building or starting images", () => {
    expect(dockerfile).not.toContain(
      'test -n "$NEXT_PUBLIC_FEEDBACK_FORM_URL"',
    );
    expect(entrypoint).not.toContain(
      "NEXT_PUBLIC_FEEDBACK_FORM_URL is required",
    );
  });

  it("only validates the feedback URL when one is configured", () => {
    expect(entrypoint).toContain("if (feedbackFormUrl)");
    expect(entrypoint).toContain('const allowedHosts = ["feishu.cn", "larksuite.com"]');
  });

  it("publishes images when the optional repository variable is empty", () => {
    expect(publishWorkflow).not.toContain(
      "vars.NEXT_PUBLIC_FEEDBACK_FORM_URL != ''",
    );
    expect(publishWorkflow).not.toContain('test -n "$FEEDBACK_FORM_URL"');
    expect(publishWorkflow).toContain("if (process.env.FEEDBACK_FORM_URL)");
  });
});
