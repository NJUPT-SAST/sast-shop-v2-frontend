"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { LoadFailure } from "@workspace/ui/components/load-failure";

type PurchaseTaskErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PurchaseTaskError({ reset }: PurchaseTaskErrorProps) {
  return (
    <LoadFailure
      variant="page"
      className="flex-1"
      title="采购任务加载失败"
      description="网络或服务暂时不可用，请重试。已保存的采购结果不会受影响。"
      onRetry={reset}
      secondaryAction={
        <Button asChild variant="outline" size="touch">
          <Link href="/orders?type=errand&view=captain">返回任务列表</Link>
        </Button>
      }
    />
  );
}
