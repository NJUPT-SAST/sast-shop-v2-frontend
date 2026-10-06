import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ErrandDemandHallLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载跑腿需求">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <Skeleton className="h-9 w-full max-w-md rounded-md" aria-hidden="true" />
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
