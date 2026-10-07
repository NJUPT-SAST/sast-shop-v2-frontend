import Link from "@/components/mobile-link";
import { Button } from "@workspace/ui/components/button";
import { BrandIllustration } from "@/components/brand-illustration";
import { Empty } from "@workspace/ui/components/empty";

export default function SpotOrderNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        illustration={<BrandIllustration name="search-empty" size={112} />}
        title="没有找到现货订单"
        description="订单可能不存在，或当前账号无权查看。"
        action={
          <Button asChild size="touch">
            <Link href="/orders" replace>
              返回订单列表
            </Link>
          </Button>
        }
      />
    </div>
  );
}
