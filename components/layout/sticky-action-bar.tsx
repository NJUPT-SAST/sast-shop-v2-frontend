import type { ReactNode } from "react"

type Props = {
  children: ReactNode
  className?: string
}

// Bottom-anchored action bar used on detail pages (listing detail, order detail).
// Already includes safe-area + backdrop blur via the .shop-action-bar class.
export function StickyActionBar({ children, className }: Props) {
  return <div className={`shop-action-bar ${className ?? ""}`}>{children}</div>
}
