import { Skeleton } from "@workspace/ui/components/skeleton";

export default function PurchaseTaskLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载采购任务">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div
        className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5"
        aria-hidden="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <section className="space-y-4" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid gap-4 2xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex gap-4 rounded-xl border bg-card p-5"
            >
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
