import Link from "next/link";
import { RiFileList3Line } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";

export default function BuyerErrandOrderNotFound() {
  return (
    <Empty
      icon={<RiFileList3Line className="size-5" />}
      title="没有找到这笔跑腿订单"
      description="订单编号无效，或当前账号无权查看。"
      action={
        <Button asChild>
          <Link href="/orders?type=errand">返回跑腿订单</Link>
        </Button>
      }
    />
  );
}
