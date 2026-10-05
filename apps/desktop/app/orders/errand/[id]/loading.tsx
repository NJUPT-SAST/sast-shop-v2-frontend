import { Skeleton } from "@workspace/ui/components/skeleton";

export default function BuyerErrandOrderLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载跑腿订单">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div
        className="flex gap-6 rounded-xl border bg-card p-5"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div
        className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)]"
        aria-hidden="true"
      >
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-6 w-28" />
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-t pt-4">
              <Skeleton className="size-24 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
