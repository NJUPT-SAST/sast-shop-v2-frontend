import { Skeleton } from "@workspace/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <div className="grid grid-cols-[7fr_3fr] gap-5">
        <Skeleton className="h-96" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
