import { Skeleton } from "@workspace/ui/components/skeleton";

export default function GroupShopLoading() {
  return (
    <div className="space-y-6" aria-label="正在加载店铺商品">
      <Skeleton className="h-24 w-full max-w-2xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
