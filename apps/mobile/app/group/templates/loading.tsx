import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ProductTemplatesLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-5 pb-4 pt-6"
      role="status"
      aria-label="商品模板加载中"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-24 rounded-md" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <Skeleton className="size-14 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="size-11 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
