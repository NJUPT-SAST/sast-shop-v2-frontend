import { Skeleton } from "@workspace/ui/components/skeleton";

export default function GroupLoading() {
  return (
    <div className="space-y-8" role="status" aria-label="正在加载团购工作台">
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
        aria-hidden="true"
      >
        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-xl border bg-card p-4"
              >
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <div className="grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border bg-card p-3"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </aside>
      </div>
    </div>
  );
}
