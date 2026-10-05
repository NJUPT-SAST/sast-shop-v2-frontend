import { Skeleton } from "@workspace/ui/components/skeleton";

export default function PublishSpotLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-6 py-6"
      role="status"
      aria-label="上架现货加载中"
    >
      <Skeleton className="h-7 w-24" />
      <section className="space-y-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full rounded-md" />
      </section>
    </div>
  );
}
