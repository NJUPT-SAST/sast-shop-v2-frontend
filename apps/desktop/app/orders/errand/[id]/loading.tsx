import { Skeleton } from "@workspace/ui/components/skeleton";

export default function BuyerErrandOrderLoading() {
  return (
    <div className="space-y-6" aria-label="正在加载跑腿订单">
      <Skeleton className="h-24 w-full max-w-xl" />
      <Skeleton className="h-20" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
