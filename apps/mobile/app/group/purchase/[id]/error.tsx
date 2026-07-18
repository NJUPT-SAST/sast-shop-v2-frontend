"use client";

import { RiErrorWarningLine } from "@remixicon/react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";

type PurchaseTaskErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PurchaseTaskError({ reset }: PurchaseTaskErrorProps) {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={<RiErrorWarningLine className="size-5" />}
        title="采购任务加载失败"
        description="网络或服务暂时不可用，请重试。已保存的采购结果不会受影响。"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={reset}>
              重新加载
            </Button>
            <Button asChild variant="outline">
              <Link href="/orders?type=errand&view=captain">返回任务列表</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
