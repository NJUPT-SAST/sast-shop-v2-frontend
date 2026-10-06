import { Skeleton } from "@workspace/ui/components/skeleton";

export function OrdersPageSkeleton() {
  return (
    <div className="space-y-6 pb-8" role="status" aria-label="正在加载订单">
      <div className="flex items-center justify-between" aria-hidden="true">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        aria-hidden="true"
      >
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      </div>
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex min-w-0 items-center gap-4 rounded-xl border bg-card p-4"
          >
            <Skeleton className="size-16 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-5 w-20" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
