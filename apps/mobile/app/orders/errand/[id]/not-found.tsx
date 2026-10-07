import Link from "@/components/mobile-link";
import { Button } from "@workspace/ui/components/button";
import { BrandIllustration } from "@/components/brand-illustration";
import { Empty } from "@workspace/ui/components/empty";

export default function BuyerErrandOrderNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        illustration={<BrandIllustration name="search-empty" size={112} />}
        title="没有找到这笔跑腿订单"
        description="订单可能已被移除，或当前账号没有查看权限。"
        action={
          <Button asChild size="touch">
            <Link href="/orders?type=errand" replace>
              返回跑腿订单
            </Link>
          </Button>
        }
      />
    </div>
  );
}
