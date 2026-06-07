import { Skeleton } from "@heroui/react"

type Props = {
  count?: number
  className?: string
}

export function SkeletonList({ count = 6, className }: Props) {
  return (
    <div aria-busy="true" className={`flex flex-col gap-2 ${className ?? ""}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          className="flex items-center gap-3 rounded-shop-md bg-shop-bg-white p-3 shadow-shop-sm"
          // biome-ignore lint/suspicious/noArrayIndexKey: positional placeholder
          key={i}
        >
          <Skeleton className="size-12 rounded-shop-sm" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-3/5 rounded" />
            <Skeleton className="h-3 w-2/5 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}
