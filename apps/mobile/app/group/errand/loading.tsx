import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ErrandDemandHallLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-5 py-6"
      role="status"
      aria-label="跑腿大厅加载中"
    >
      <section>
        <Skeleton className="h-7 w-36 rounded-lg" />
      </section>

      <Skeleton className="h-11 w-full rounded-lg" />

      <section className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-32 rounded-lg" />
                  <Skeleton className="h-4 w-28 rounded-lg" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="size-7 rounded-full" />
                </div>
                <Skeleton className="h-4 w-14 rounded-lg" />
              </div>
              <Skeleton className="size-5" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
