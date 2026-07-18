import { Skeleton } from "@workspace/ui/components/skeleton"

export function MobilePageSkeleton({
  variant = "list",
}: {
  variant?: "grid" | "list" | "profile"
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 py-6" aria-label="页面加载中">
      <Skeleton className="h-7 w-24" />
      {variant === "profile" ? (
        <>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </>
      ) : (
        <>
          <Skeleton className="h-11 w-full rounded-md" />
          <div
            className={
              variant === "grid" ? "grid grid-cols-2 gap-3" : "grid gap-3"
            }
          >
            {Array.from({ length: variant === "grid" ? 6 : 4 }, (_, index) => (
              <Skeleton
                key={index}
                className={
                  variant === "grid"
                    ? "aspect-[0.72] rounded-lg"
                    : "h-28 rounded-lg"
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
