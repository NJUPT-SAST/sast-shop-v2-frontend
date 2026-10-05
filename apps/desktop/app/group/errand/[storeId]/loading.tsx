import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ErrandDemandDetailLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载需求详情">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="min-w-0 rounded-xl border bg-card">
            <div className="flex items-start gap-4 p-5">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
            <div className="space-y-3 border-t p-5">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
        aria-hidden="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}
