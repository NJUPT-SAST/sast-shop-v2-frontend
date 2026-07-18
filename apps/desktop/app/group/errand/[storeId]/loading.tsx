import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ErrandDemandDetailLoading() {
  return (
    <div className="space-y-6" aria-label="正在加载需求详情">
      <Skeleton className="h-24 w-full max-w-xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
