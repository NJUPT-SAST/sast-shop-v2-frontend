import Link from "next/link";
import { BrandIllustration } from "@/components/brand-illustration";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";

export default function PageNotFound() {
  return (
    <Empty
      className="flex-1"
      illustration={<BrandIllustration name="search-empty" size={112} />}
      title="没有找到这个页面"
      description="链接可能已失效，请确认页面地址"
      action={
        <Button asChild size="touch">
          <Link href="/shop" replace>
            前往商城
          </Link>
        </Button>
      }
    />
  );
}
