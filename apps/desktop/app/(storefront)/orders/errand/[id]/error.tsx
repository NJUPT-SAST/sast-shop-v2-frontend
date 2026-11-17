"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { LoadFailure } from "@workspace/ui/components/load-failure";

export default function BuyerErrandOrderError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <LoadFailure
      variant="page"
      title="跑腿订单加载失败"
      description="请稍后重试。"
      onRetry={reset}
      secondaryAction={
        <Button asChild variant="outline">
          <Link href="/orders?type=errand">返回订单</Link>
        </Button>
      }
    />
  );
}
