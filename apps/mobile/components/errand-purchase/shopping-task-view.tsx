"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RiCheckboxBlankLine,
  RiCheckboxLine,
  RiCloseCircleLine,
  RiIndeterminateCircleLine,
} from "@remixicon/react"
import {
  cancelTask,
  saveShoppingTaskItem,
  transitionToPendingDistributing,
  type DataSource,
  type ShoppingTaskDetail,
  type ShoppingTaskItem,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "sonner"

import { ManagedImage } from "@/components/managed-image"

export type ShoppingTaskViewProps = {
  dataSource: DataSource
  connectBaseUrl: string
  detail: ShoppingTaskDetail
}

type DialogState =
  | { type: "none" }
  | { type: "partial"; item: ShoppingTaskItem }
  | { type: "skip"; item: ShoppingTaskItem }
  | { type: "confirm_complete" }
  | { type: "confirm_cancel" }

function isPurchased(item: ShoppingTaskItem): boolean {
  return item.purchasedQuantity !== null
}

function getStatusIcon(item: ShoppingTaskItem) {
  if (item.purchasedQuantity === null) return null
  if (item.purchasedQuantity === 0)
    return <RiCloseCircleLine className="size-5 text-destructive" />
  if (item.purchasedQuantity < item.requiredQuantity)
    return <RiIndeterminateCircleLine className="size-5 text-amber-500" />
  return <RiCheckboxLine className="size-5 text-emerald-500" />
}

export function ShoppingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
}: ShoppingTaskViewProps) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [items, setItems] = useState<ShoppingTaskItem[]>(detail.taskItems)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ type: "none" })
  const [partialQty, setPartialQty] = useState("")
  const [skipReason, setSkipReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const serviceOptions = { dataSource, connectBaseUrl }

  const unprocessed = items.filter((i) => !isPurchased(i))
  const processed = items.filter((i) => isPurchased(i))
  const allDone = unprocessed.length === 0

  const totalProductCents = items.reduce((sum, i) => {
    if (i.purchasedQuantity === null || i.purchasedQuantity === 0) return sum
    return sum + i.actualUnitPriceCents * i.purchasedQuantity
  }, 0)
  const totalServiceFeeCents = items.reduce((sum, i) => {
    if (i.purchasedQuantity === null || i.purchasedQuantity === 0) return sum
    return sum
  }, 0)

  const updateItem = (updated: ShoppingTaskItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  const handleSave = async (
    item: ShoppingTaskItem,
    purchasedQuantity: number,
    nonPurchaseReason?: string
  ) => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await saveShoppingTaskItem(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.id,
          purchasedQuantity,
          nonPurchaseReason: nonPurchaseReason ?? null,
          itemUpdatedAt: item.updatedAt,
        },
        serviceOptions
      )
      updateItem({
        ...item,
        purchasedQuantity,
        nonPurchaseReason: nonPurchaseReason ?? null,
      })
      setDialog({ type: "none" })
      setOpenSwipeId(null)
    } catch {
      toast.error("保存失败，请稍后再试")
    } finally {
      submittingRef.current = false
    }
  }

  const handleRevoke = async (item: ShoppingTaskItem) => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await saveShoppingTaskItem(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.id,
          purchasedQuantity: 0,
          nonPurchaseReason: null,
          itemUpdatedAt: item.updatedAt,
        },
        serviceOptions
      )
      updateItem({ ...item, purchasedQuantity: null, nonPurchaseReason: null })
    } catch {
      toast.error("撤销失败，请稍后再试")
    } finally {
      submittingRef.current = false
    }
  }

  const handleComplete = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await transitionToPendingDistributing(detail.taskId, null, serviceOptions)
      setDialog({ type: "none" })
      router.refresh()
    } catch {
      toast.error("操作失败，请稍后再试")
      setSubmitting(false)
    } finally {
      submittingRef.current = false
    }
  }

  const handleCancel = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await cancelTask(detail.taskId, null, serviceOptions)
      setDialog({ type: "none" })
      router.push("/group")
    } catch {
      toast.error("取消失败，请稍后再试")
      setSubmitting(false)
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-7">
            {detail.storeName}
          </h1>
          <p className="text-sm text-muted-foreground">采购中</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={() => setDialog({ type: "confirm_cancel" })}
        >
          取消采购
        </Button>
      </section>

      {unprocessed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            未处理 ({unprocessed.length})
          </h2>
          <div className="flex flex-col gap-3">
            {unprocessed.map((item) => (
              <SwipeableShoppingCard
                key={item.id}
                item={item}
                isOpen={openSwipeId === item.id}
                onSwipeOpen={() => setOpenSwipeId(item.id)}
                onSwipeClose={() => setOpenSwipeId(null)}
                onBuyAll={() => handleSave(item, item.requiredQuantity)}
                onBuyPartial={() => {
                  setPartialQty("")
                  setDialog({ type: "partial", item })
                }}
                onSkip={() => {
                  setSkipReason("")
                  setDialog({ type: "skip", item })
                }}
              />
            ))}
          </div>
        </section>
      )}

      {processed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            已处理 ({processed.length})
          </h2>
          <div className="flex flex-col gap-3">
            {processed.map((item) => (
              <ProcessedShoppingCard
                key={item.id}
                item={item}
                onRevoke={() => handleRevoke(item)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10 mt-auto rounded-lg border bg-card p-2">
        <Button
          type="button"
          disabled={!allDone}
          className="h-12 w-full"
          onClick={() => setDialog({ type: "confirm_complete" })}
        >
          {allDone
            ? "确认完成采购"
            : `已处理 ${processed.length}/${items.length} 种`}
        </Button>
      </div>

      <ResponsiveDialog
        open={dialog.type === "partial"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" })
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>部分购买</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "partial"
                ? `输入实际购买数量（1 ~ ${dialog.item.requiredQuantity - 1}）`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {dialog.type === "partial" && (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={dialog.item.requiredQuantity - 1}
              value={partialQty}
              onChange={(e) => setPartialQty(e.target.value)}
              placeholder="购买数量"
            />
          )}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={
                dialog.type !== "partial" ||
                !partialQty ||
                Number(partialQty) < 1 ||
                Number(partialQty) >= dialog.item.requiredQuantity
              }
              onClick={() => {
                if (dialog.type !== "partial") return
                void handleSave(dialog.item, Number(partialQty))
              }}
            >
              确认
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "skip"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" })
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>不购买</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              可选填不购买原因（最多 15 字）
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Textarea
            maxLength={15}
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="不购买原因（可选）"
            rows={3}
          />
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (dialog.type !== "skip") return
                void handleSave(dialog.item, 0, skipReason || undefined)
              }}
            >
              确认不购买
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "confirm_complete"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" })
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认完成采购</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              请核对采购结果后确认
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="rounded-lg border bg-secondary/60 p-3 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">商品费合计</span>
              <span className="font-medium">
                {formatPrice(totalProductCents)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">合计</span>
              <span className="text-base font-semibold">
                {formatPrice(totalProductCents + totalServiceFeeCents)}
              </span>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setDialog({ type: "none" })}
            >
              返回
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void handleComplete()}
            >
              {submitting ? "提交中" : "确认"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "confirm_cancel"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" })
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>取消采购</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              确认取消此次采购任务？此操作不可撤销。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setDialog({ type: "none" })}
            >
              返回
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleCancel()}
            >
              {submitting ? "取消中" : "确认取消"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}

function SwipeableShoppingCard({
  item,
  isOpen,
  onSwipeOpen,
  onSwipeClose,
  onBuyAll,
  onBuyPartial,
  onSkip,
}: {
  item: ShoppingTaskItem
  isOpen: boolean
  onSwipeOpen: () => void
  onSwipeClose: () => void
  onBuyAll: () => void
  onBuyPartial: () => void
  onSkip: () => void
}) {
  const touchStartX = useRef<number | null>(null)

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      <div
        className="flex items-center gap-3 p-3 transition-transform duration-200"
        style={{ transform: isOpen ? "translateX(-160px)" : "translateX(0)" }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const delta = touchStartX.current - e.changedTouches[0].clientX
          if (delta > 40) onSwipeOpen()
          else if (delta < -20) onSwipeClose()
          touchStartX.current = null
        }}
      >
        <ManagedImage
          src={item.productImageUrl}
          alt={item.productTitle}
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-5">
            {item.productTitle}
          </p>
          {item.productDescription ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {item.productDescription}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            需 {item.requiredQuantity} 件
          </p>
        </div>
        <div className="hidden shrink-0 flex-col gap-1.5 sm:flex">
          <Button
            type="button"
            size="sm"
            className="bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={onBuyAll}
          >
            全部购买
          </Button>
          {item.requiredQuantity > 1 && (
            <Button
              type="button"
              size="sm"
              className="bg-amber-500 text-white hover:bg-amber-600"
              onClick={onBuyPartial}
            >
              部分购买
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onSkip}
          >
            不购买
          </Button>
        </div>
      </div>

      <div
        className="absolute right-0 top-0 flex h-full w-40 items-stretch sm:hidden"
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-emerald-500 text-white text-xs font-medium"
          onClick={onBuyAll}
        >
          全部购买
        </button>
        {item.requiredQuantity > 1 && (
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-amber-500 text-white text-xs font-medium"
            onClick={onBuyPartial}
          >
            部分购买
          </button>
        )}
        <button
          type="button"
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-xs font-medium"
          onClick={onSkip}
        >
          不购买
        </button>
      </div>
    </div>
  )
}

function ProcessedShoppingCard({
  item,
  onRevoke,
}: {
  item: ShoppingTaskItem
  onRevoke: () => void
}) {
  const icon = getStatusIcon(item)
  const statusText =
    item.purchasedQuantity === 0
      ? `不购买${item.nonPurchaseReason ? `：${item.nonPurchaseReason}` : ""}`
      : item.purchasedQuantity !== null &&
          item.purchasedQuantity < item.requiredQuantity
        ? `部分购买：${item.purchasedQuantity}/${item.requiredQuantity} 件`
        : `全部购买：${item.purchasedQuantity} 件`

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 opacity-75">
      <button
        type="button"
        className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="撤销采购结果"
        onClick={onRevoke}
      >
        {icon ?? <RiCheckboxBlankLine className="size-5" />}
      </button>
      <ManagedImage
        src={item.productImageUrl}
        alt={item.productTitle}
        className="size-14 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-5">
          {item.productTitle}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{statusText}</p>
      </div>
    </div>
  )
}
