import { Skeleton } from "@workspace/ui/components/skeleton";

import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export default function CollectingPaymentLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-5 py-5"
      role="status"
      aria-label="支付核对加载中"
    >
      <Skeleton className="h-7 w-24" />
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3 p-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </section>
      <MobileFixedFooter>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-12 flex-1 rounded-md" />
      </MobileFixedFooter>
    </div>
  );
}
