import { Icon } from "@iconify/react"

type Props = {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon = "material-symbols:inventory-2-outline-rounded",
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-shop-lg bg-shop-bg-white px-6 py-12 text-center ${className ?? ""}`}
      role="status"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-shop-primary-wash text-shop-primary">
        <Icon className="size-8" icon={icon} />
      </div>
      <p className="text-[15px] font-medium text-shop-text-primary">{title}</p>
      {description ? (
        <p className="max-w-xs text-[13px] text-shop-text-tertiary">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
