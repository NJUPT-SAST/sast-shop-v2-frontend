"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { LoadFailure } from "@workspace/ui/components/load-failure";

export default function PurchaseTaskError({ reset }: { reset: () => void }) {
  return (
    <LoadFailure
      variant="page"
      title="采购任务加载失败"
      description="任务状态可能已变化，请重新加载。"
      onRetry={reset}
      secondaryAction={
        <Button asChild variant="outline">
          <Link href="/orders?type=errand&view=captain">返回任务列表</Link>
        </Button>
      }
    />
  );
}
