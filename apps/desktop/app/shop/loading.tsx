import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ShopLoading() {
  return (
    <div className="space-y-6 pb-8" role="status" aria-label="正在加载商城">
      <div
        className="flex items-center justify-between gap-6"
        aria-hidden="true"
      >
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="min-w-0 overflow-hidden rounded-xl border bg-card"
          >
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
