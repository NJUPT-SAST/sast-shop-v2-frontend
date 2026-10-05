import { Skeleton } from "@workspace/ui/components/skeleton";

import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export default function BuyerErrandOrderLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-2 py-3"
      role="status"
      aria-label="跑腿订单加载中"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-start gap-3">
              <Skeleton className="size-18 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-y py-2">
              {Array.from({ length: 3 }, (_, column) => (
                <div key={column} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, row) => (
                <div key={row} className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex justify-between gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t pt-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex min-h-8 justify-between gap-3">
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
