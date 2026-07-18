import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ProductTemplatesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-60 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
