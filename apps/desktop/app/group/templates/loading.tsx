import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ProductTemplatesLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载商品模板">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <Skeleton className="h-9 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div
        className="grid gap-4 sm:grid-cols-[18rem_minmax(0,1fr)]"
        aria-hidden="true"
      >
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
      <div
        className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex min-w-0 gap-4 rounded-xl border bg-card p-4"
          >
            <Skeleton className="size-20 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
