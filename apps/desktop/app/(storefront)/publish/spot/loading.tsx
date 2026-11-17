import { Skeleton } from "@workspace/ui/components/skeleton";

export default function PublishSpotLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载现货上架表单">
      <div
        className="flex items-start justify-between gap-4"
        aria-hidden="true"
      >
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div
        className="grid max-w-3xl gap-6 rounded-xl border bg-card p-6"
        aria-hidden="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
