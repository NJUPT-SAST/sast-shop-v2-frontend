import { Skeleton } from "@heroui/react"

export function SkeletonDetail() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 pb-20">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-3 px-4">
        <Skeleton className="h-6 w-3/5 rounded" />
        <Skeleton className="h-8 w-1/3 rounded" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
      </div>
      <div className="mx-4 flex flex-col gap-2 rounded-shop-lg bg-shop-bg-white p-4 shadow-shop-sm">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-4 w-3/5 rounded" />
      </div>
    </div>
  )
}
