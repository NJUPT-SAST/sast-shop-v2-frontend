import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载个人中心">
      <div
        className="flex items-center justify-between gap-6"
        aria-hidden="true"
      >
        <Skeleton className="h-9 w-20" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }, (_, column) => (
          <section key={column} className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <div className="divide-y rounded-xl border bg-card">
              {Array.from({ length: column === 0 ? 3 : 2 }, (_, row) => (
                <div key={row} className="flex items-center gap-4 p-4">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="size-4 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
