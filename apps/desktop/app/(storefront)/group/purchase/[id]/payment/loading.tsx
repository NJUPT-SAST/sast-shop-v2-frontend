import { Skeleton } from "@workspace/ui/components/skeleton";

export default function CollectingPaymentLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载支付核对">
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div
        className="grid grid-cols-2 gap-6 rounded-xl border bg-card p-5"
        aria-hidden="true"
      >
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-36" />
          </div>
        ))}
      </div>
      <section className="space-y-4" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-xl border bg-card">
              <div className="flex items-center gap-3 p-5">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="border-t p-4">
                <Skeleton className="ml-auto h-8 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <div
        className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
        aria-hidden="true"
      >
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}
