"use client";

import { LoadFailure } from "@workspace/ui/components/load-failure";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <LoadFailure
      variant="page"
      title="订单详情加载失败"
      description="网络异常或订单状态已更新，请重新加载。"
      onRetry={reset}
    />
  );
}
