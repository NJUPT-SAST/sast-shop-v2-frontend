import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ErrandDemandHallLoading() {
  return (
    <div className="space-y-6" aria-label="正在加载跑腿需求">
      <Skeleton className="h-24 w-full max-w-xl" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );
}
