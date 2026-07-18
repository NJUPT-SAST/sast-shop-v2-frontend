import { Skeleton } from "@workspace/ui/components/skeleton";
import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export default function ErrandDemandDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-6">
      <section className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-56" />
      </section>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div
            key={groupIndex}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex gap-3">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t pt-3">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex min-h-16 items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <Skeleton className="size-4 rounded-sm" />
                  <Skeleton className="size-9 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <MobileFixedFooter>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </MobileFixedFooter>
    </div>
  );
}
