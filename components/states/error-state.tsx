import { isApiError } from "@/lib/api/errors"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"

type Props = {
  title?: string
  description?: string
  error?: unknown
  onRetry?: () => void
  className?: string
}

function describeError(error: unknown): { message?: string; requestId?: string } {
  if (!error) return {}
  if (isApiError(error)) {
    return { message: error.message, requestId: error.requestId }
  }
  if (error instanceof Error) return { message: error.message }
  return { message: String(error) }
}

export function ErrorState({ title = "出错了", description, error, onRetry, className }: Props) {
  const { message, requestId } = describeError(error)
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-shop-lg bg-shop-bg-white px-6 py-10 text-center ${className ?? ""}`}
      role="alert"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-shop-danger-soft text-shop-danger">
        <Icon className="size-8" icon="material-symbols:error-outline-rounded" />
      </div>
      <p className="text-[15px] font-medium text-shop-text-primary">{title}</p>
      {description || message ? (
        <p className="max-w-xs text-[13px] text-shop-text-tertiary">{description ?? message}</p>
      ) : null}
      {requestId ? (
        <p className="text-[11px] text-shop-text-tertiary">request_id: {requestId}</p>
      ) : null}
      {onRetry ? (
        <Button onPress={onRetry} size="sm" variant="secondary">
          重试
        </Button>
      ) : null}
    </div>
  )
}
