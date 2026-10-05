import { Skeleton } from "@workspace/ui/components/skeleton";

import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export default function SpotOrderLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-2 py-3"
      role="status"
      aria-label="现货订单加载中"
    >
      <Skeleton className="h-7 w-24" />
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-start gap-3 border-y py-2">
          <Skeleton className="size-16 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-8 items-center justify-between gap-3"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <MobileFixedFooter>
        <Skeleton className="h-12 w-full rounded-md" />
      </MobileFixedFooter>
    </div>
  );
}
