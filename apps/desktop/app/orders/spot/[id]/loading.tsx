import { Skeleton } from "@workspace/ui/components/skeleton";

export default function SpotOrderLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="正在加载现货订单">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div
        className="flex gap-6 rounded-xl border bg-card p-5"
        aria-hidden="true"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-1 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-full max-w-28" />
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] gap-5"
        aria-hidden="true"
      >
        <div className="space-y-5 rounded-xl border bg-card p-5">
          <Skeleton className="h-6 w-28" />
          <div className="flex gap-4 border-t pt-5">
            <Skeleton className="size-24 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <div className="space-y-5 rounded-xl border bg-card p-5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
