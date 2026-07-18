import { RiFileSearchLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";
import Link from "next/link";

export default function SpotOrderNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={<RiFileSearchLine className="size-5" />}
        title="没有找到现货订单"
        description="订单可能不存在，或当前账号无权查看。"
        action={
          <Button asChild>
            <Link href="/orders">返回订单列表</Link>
          </Button>
        }
      />
    </div>
  );
}
