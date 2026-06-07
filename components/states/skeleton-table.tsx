import { Skeleton } from "@heroui/react"

type Props = {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ rows = 8, columns = 5, className }: Props) {
  return (
    <div
      aria-busy="true"
      className={`overflow-hidden rounded-shop-lg bg-shop-bg-white shadow-shop-sm ${className ?? ""}`}
    >
      <div
        className="grid border-b border-shop-border-light px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional
          <Skeleton className="h-4 w-3/5 rounded" key={i} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          className="grid border-b border-shop-border-light px-4 py-4 last:border-0"
          // biome-ignore lint/suspicious/noArrayIndexKey: positional
          key={r}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional
            <Skeleton className="h-4 w-4/5 rounded" key={c} />
          ))}
        </div>
      ))}
    </div>
  )
}
