import { Skeleton } from "@workspace/ui/components/skeleton";

type PageVariant = "shop" | "group" | "orders" | "profile";

export function MobilePageSkeleton({ variant }: { variant: PageVariant }) {
  if (variant === "shop") {
    return (
      <div
        className="flex flex-1 flex-col gap-6 py-6"
        role="status"
        aria-label="商城加载中"
      >
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "group") {
    return (
      <div
        className="flex flex-1 flex-col gap-8 py-6"
        role="status"
        aria-label="团购加载中"
      >
        <Skeleton className="h-7 w-20" />
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-11 w-24" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-11 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-36 flex-col justify-between rounded-lg border bg-card p-4"
              >
                <Skeleton className="size-11 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <Skeleton className="h-7 w-24" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border bg-card p-5"
              >
                <Skeleton className="size-16 rounded-lg" />
                <Skeleton className="h-5 w-4/5" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (variant === "orders") {
    return (
      <div
        className="flex flex-1 flex-col gap-4 py-4"
        role="status"
        aria-label="订单加载中"
      >
        <Skeleton className="h-7 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-lg" />
          <Skeleton className="h-11 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton
              key={index}
              className={`${index === 0 ? "w-12" : "w-16"} h-8 shrink-0 rounded-full`}
            />
          ))}
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="space-y-2 p-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-2/5" />
              </div>
              <div className="flex items-center gap-3 px-4 pb-3">
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
              <div className="flex justify-between border-t bg-muted/30 px-4 py-3">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-6 py-6"
      role="status"
      aria-label="个人中心加载中"
    >
      <Skeleton className="h-7 w-20" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-16 items-center gap-3 border-b px-3 last:border-b-0"
          >
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="ml-auto size-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
