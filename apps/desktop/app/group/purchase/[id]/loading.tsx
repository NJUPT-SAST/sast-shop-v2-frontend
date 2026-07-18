import { Skeleton } from "@workspace/ui/components/skeleton";

export default function PurchaseTaskLoading() {
  return (
    <div className="space-y-6" aria-label="正在加载采购任务">
      <Skeleton className="h-24 w-full max-w-xl" />
      <Skeleton className="h-20" />
      <Skeleton className="h-80" />
    </div>
  );
}
