import Link from "next/link";
import { RiStore2Line } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";

export default function ErrandDemandDetailNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        icon={<RiStore2Line className="size-5" />}
        title="没有找到这个店铺"
        description="店铺可能已被移除，或链接中的编号无效。"
        action={
          <Button asChild>
            <Link href="/group/errand">返回跑腿大厅</Link>
          </Button>
        }
      />
    </div>
  );
}
