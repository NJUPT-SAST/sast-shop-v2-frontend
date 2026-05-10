import { Skeleton } from "@heroui/react"

type Props = {
  count?: number
  /** Aspect ratio of the media area. */
  variant?: "product" | "crowdfund"
  className?: string
}

export function SkeletonGrid({ count = 8, variant = "product", className }: Props) {
  const aspect = variant === "crowdfund" ? "aspect-[5/3]" : "aspect-square"
  return (
    <div
      aria-busy="true"
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className ?? ""}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are positional
        <div className="overflow-hidden rounded-shop-lg bg-shop-bg-white shadow-shop-sm" key={i}>
          <Skeleton className={`w-full ${aspect}`} />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-4/5 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
            <Skeleton className="h-5 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
