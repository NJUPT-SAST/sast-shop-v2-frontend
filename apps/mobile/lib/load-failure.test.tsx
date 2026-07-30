import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoadFailure } from "@workspace/ui/components/load-failure";

describe("LoadFailure", () => {
  it("renders an accessible retry button", () => {
    const markup = renderToStaticMarkup(
      <LoadFailure
        title="订单加载失败"
        description="请稍后重试。"
        onRetry={vi.fn()}
      />,
    );

    expect(markup).toContain('data-slot="load-failure"');
    expect(markup).toContain('role="alert"');
    expect(markup).toMatch(/aria-labelledby="[^"]+"/);
    expect(markup).toMatch(/aria-describedby="[^"]+"/);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("重新加载");
    expect(markup).toContain("请稍后重试");
    expect(markup).not.toContain("请稍后重试。");
    expect(markup).not.toContain("href=");
  });

  it("renders a real reload link in compact contexts", () => {
    const markup = renderToStaticMarkup(
      <LoadFailure
        variant="compact"
        surface="plain"
        title="资料加载失败"
        retryHref="/profile"
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-surface="plain"');
    expect(markup).toContain('href="/profile"');
    expect(markup).not.toContain('role="button"');
    expect(markup).not.toContain("aria-describedby=");
  });
});
