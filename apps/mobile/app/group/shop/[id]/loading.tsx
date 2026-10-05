import { Skeleton } from "@workspace/ui/components/skeleton";

import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export default function GroupShopLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-5 py-5"
      role="status"
      aria-label="店铺商品加载中"
    >
      <section className="flex items-start gap-3 rounded-lg border bg-card p-3">
        <Skeleton className="size-14 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </section>
      <section className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <div className="columns-1 gap-3 md:columns-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="mb-3 flex break-inside-avoid gap-3 rounded-lg border bg-card p-3"
            >
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="size-11 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <MobileFixedFooter>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-12 w-28 rounded-md" />
      </MobileFixedFooter>
    </div>
  );
}
