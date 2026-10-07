import Link from "@/components/mobile-link";
import { Button } from "@workspace/ui/components/button";
import { BrandIllustration } from "@/components/brand-illustration";
import { Empty } from "@workspace/ui/components/empty";

export default function ErrandDemandDetailNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <Empty
        illustration={<BrandIllustration name="search-empty" size={112} />}
        title="没有找到这个店铺"
        description="店铺可能已被移除，或链接中的编号无效。"
        action={
          <Button asChild size="touch">
            <Link href="/group/errand" replace>
              返回跑腿大厅
            </Link>
          </Button>
        }
      />
    </div>
  );
}
