"use client";

import Link from "next/link";
import { RiErrorWarningLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";

export default function GroupShopError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={<RiErrorWarningLine className="size-5" />}
        title="店铺商品加载失败"
        description="网络或服务暂时不可用，请稍后重试。"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={reset}>
              重新加载
            </Button>
            <Button asChild variant="outline">
              <Link href="/shop">返回商城</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
