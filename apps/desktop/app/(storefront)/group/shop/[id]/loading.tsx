import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";

export default function GroupShopLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Button asChild variant="outline">
          <Link href="/group">返回团购工作台</Link>
        </Button>
      </div>
      <div
        className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[10rem_minmax(0,1fr)_21rem] xl:grid-cols-[11rem_minmax(0,1fr)_22rem]"
        role="status"
        aria-label="正在加载店铺商品"
      >
        <div
          aria-hidden="true"
          className="space-y-2 self-start rounded-xl border bg-card p-3"
        >
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-6 w-28" />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex gap-4 rounded-xl border bg-card p-4"
              >
                <Skeleton className="size-24 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-8 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          aria-hidden="true"
          className="space-y-4 self-start rounded-xl border bg-card p-5 sm:col-start-2 lg:col-start-3 lg:row-start-1"
        >
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
