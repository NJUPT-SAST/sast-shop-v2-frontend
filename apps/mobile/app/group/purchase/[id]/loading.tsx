import { Skeleton } from "@workspace/ui/components/skeleton";

import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export default function PurchaseTaskLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-5 py-5"
      role="status"
      aria-label="采购任务加载中"
    >
      <section className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </section>
      <section className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <Skeleton className="size-5 shrink-0 rounded-sm" />
            <Skeleton className="size-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </section>
      <MobileFixedFooter>
        <Skeleton className="h-12 w-full rounded-md" />
      </MobileFixedFooter>
    </div>
  );
}
