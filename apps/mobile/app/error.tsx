"use client";

import { LoadFailure } from "@/components/load-failure";

export default function PageError({ retry }: { retry: () => void }) {
  return (
    <LoadFailure
      variant="page"
      title="页面加载失败"
      description="暂时无法打开此页面，请稍后重试"
      onRetry={retry}
    />
  );
}
