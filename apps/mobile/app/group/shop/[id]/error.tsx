"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { LoadFailure } from "@/components/load-failure";

export default function GroupShopError({ retry }: { retry: () => void }) {
  return (
    <LoadFailure
      variant="page"
      className="flex-1"
      title="店铺商品加载失败"
      description="网络或服务暂时不可用，请稍后重试。"
      onRetry={retry}
      secondaryAction={
        <Button asChild variant="outline" size="touch">
          <Link href="/group">返回团购</Link>
        </Button>
      }
    />
  );
}
