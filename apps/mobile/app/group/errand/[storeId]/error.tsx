"use client";

import Link from "@/components/mobile-link";
import { Button } from "@workspace/ui/components/button";
import { LoadFailure } from "@/components/load-failure";

export default function ErrandDemandDetailError({
  retry,
}: {
  retry: () => void;
}) {
  return (
    <LoadFailure
      variant="page"
      className="flex-1"
      title="跑腿需求加载失败"
      description="网络或服务暂时不可用，请稍后重试。"
      onRetry={retry}
      secondaryAction={
        <Button asChild variant="outline" size="touch">
          <Link href="/group/errand">返回跑腿大厅</Link>
        </Button>
      }
    />
  );
}
