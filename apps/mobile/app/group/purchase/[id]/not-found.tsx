import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { BrandIllustration } from "@/components/brand-illustration";
import { Empty } from "@workspace/ui/components/empty";

export default function PurchaseTaskNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        illustration={<BrandIllustration name="search-empty" size={112} />}
        title="没有找到采购任务"
        description="任务可能已被删除，或当前账号无权查看。"
        action={
          <Button asChild size="touch">
            <Link href="/orders?type=errand&view=captain" replace>
              返回任务列表
            </Link>
          </Button>
        }
      />
    </div>
  );
}
