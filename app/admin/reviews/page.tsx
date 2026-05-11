"use client"

import { BulkActionBar } from "@/components/admin/bulk-action-bar"
import { RowSelectCheckbox } from "@/components/admin/row-select-checkbox"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FormField } from "@/components/forms/form-field"
import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { MobileHeader } from "@/components/layout/mobile-header"
import { ResponsiveSheet } from "@/components/motion/responsive-sheet"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonList } from "@/components/states/skeleton-list"
import { isApiError } from "@/lib/api/errors"
import {
  useAdminReviews,
  useApproveReview,
  useBulkApproveReview,
  useBulkRejectReview,
  useRejectReview,
} from "@/lib/api/queries"
import type { ReviewRequest, ReviewStatus } from "@/lib/api/types"
import { useRowSelection } from "@/lib/hooks/use-row-selection"
import { formatDateTime } from "@/lib/utils/format"
import { notify } from "@/lib/utils/toast"
import { Alert, Button, Chip, Input } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { z } from "zod"

const TABS: Array<{ v: ReviewStatus; label: string }> = [
  { v: "pending", label: "待审核" },
  { v: "approved", label: "已通过" },
  { v: "rejected", label: "已拒绝" },
]

const rejectSchema = z.object({
  reason: z.string().min(1, "请填写拒绝原因").max(500, "最多 500 字"),
})
type RejectInput = z.infer<typeof rejectSchema>

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<ReviewStatus>("pending")
  const { data, isPending } = useAdminReviews(tab)
  const items = data?.items ?? []
  const allIds = useMemo(() => items.map((r) => r.id), [items])
  const selection = useRowSelection(allIds)
  const [rejectingIds, setRejectingIds] = useState<string[] | null>(null)
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false)
  const bulkApprove = useBulkApproveReview()
  const bulkReject = useBulkRejectReview()
  const approve = useApproveReview()
  const reject = useRejectReview()

  const rejectForm = useTypedForm(rejectSchema, { defaultValues: { reason: "" } })

  async function quickApprove(id: string) {
    try {
      await approve.mutateAsync(id)
      notify({ title: "已通过审核", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
    }
  }

  async function confirmBulkApprove() {
    const ids = Array.from(selection.selected)
    const res = await bulkApprove.mutateAsync(ids)
    notify({
      title:
        res.failed.length === 0
          ? `已通过 ${res.successCount} 项`
          : `成功 ${res.successCount} · 失败 ${res.failed.length}`,
      color: res.failed.length === 0 ? "success" : "warning",
    })
    selection.clear()
  }

  async function onRejectSubmit({ reason }: RejectInput) {
    if (!rejectingIds) return
    if (rejectingIds.length === 1) {
      try {
        await reject.mutateAsync({ id: rejectingIds[0], reason })
        notify({ title: "已拒绝", color: "default" })
      } catch (err) {
        notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
      }
    } else {
      const res = await bulkReject.mutateAsync({ ids: rejectingIds, reason })
      notify({
        title:
          res.failed.length === 0
            ? `已拒绝 ${res.successCount} 项`
            : `成功 ${res.successCount} · 失败 ${res.failed.length}`,
        color: res.failed.length === 0 ? "default" : "warning",
      })
      selection.clear()
    }
    setRejectingIds(null)
    rejectForm.reset()
  }

  return (
    <>
      <MobileHeader title="审核队列" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 md:gap-4 md:px-8 md:py-8">
        <header className="hidden md:block">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">审核队列</h1>
        </header>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <Button
              className="rounded-shop-pill"
              key={t.v}
              onPress={() => {
                setTab(t.v)
                selection.clear()
              }}
              size="sm"
              variant={tab === t.v ? "primary" : "outline"}
            >
              {t.label}
              {tab === t.v && data ? (
                <Chip size="sm" variant="soft">
                  <Chip.Label className="tabular-nums">{data.total}</Chip.Label>
                </Chip>
              ) : null}
            </Button>
          ))}
        </div>

        {tab === "pending" ? (
          <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
            <Button
              isPending={bulkApprove.isPending}
              onPress={() => setBulkApproveOpen(true)}
              variant="primary"
            >
              <Icon className="size-4" icon="material-symbols:check-rounded" />
              批量通过
            </Button>
            <Button
              isPending={bulkReject.isPending}
              onPress={() => setRejectingIds(Array.from(selection.selected))}
              variant="danger"
            >
              <Icon className="size-4" icon="material-symbols:block-rounded" />
              批量拒绝
            </Button>
          </BulkActionBar>
        ) : null}

        {isPending ? (
          <SkeletonList count={3} />
        ) : items.length === 0 ? (
          <EmptyState
            description={`没有${TABS.find((t) => t.v === tab)?.label}的项目`}
            icon="material-symbols:fact-check-rounded"
            title="暂无审核任务"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((r) => (
              <ReviewRow
                isSelected={tab === "pending" && selection.isSelected(r.id)}
                key={r.id}
                onApprove={() => quickApprove(r.id)}
                onReject={() => setRejectingIds([r.id])}
                onToggleSelect={() => selection.toggle(r.id)}
                review={r}
                showSelect={tab === "pending"}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        confirmLabel="确认通过"
        description={`确认通过已选 ${selection.selectedCount} 个待审核项目？通过后商品将上线。`}
        loading={bulkApprove.isPending}
        onConfirm={confirmBulkApprove}
        onOpenChange={setBulkApproveOpen}
        open={bulkApproveOpen}
        title="批量通过审核"
      />

      <ResponsiveSheet
        onOpenChange={(open) => {
          if (!open) {
            setRejectingIds(null)
            rejectForm.reset()
          }
        }}
        open={rejectingIds !== null}
        title={
          rejectingIds && rejectingIds.length > 1
            ? `拒绝 ${rejectingIds.length} 个项目`
            : "拒绝该项目"
        }
      >
        <FormProvider {...rejectForm}>
          <form className="flex flex-col gap-3" onSubmit={rejectForm.handleSubmit(onRejectSubmit)}>
            <FormField
              hint="将通过站内消息告知卖家"
              label="拒绝原因"
              maxLength={500}
              name="reason"
              required
            >
              <Input placeholder="例如：商品图片不清晰，请重新上传" variant="secondary" />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button
                isDisabled={reject.isPending || bulkReject.isPending}
                onPress={() => setRejectingIds(null)}
                variant="ghost"
              >
                取消
              </Button>
              <Button
                isPending={reject.isPending || bulkReject.isPending}
                type="submit"
                variant="danger"
              >
                确认拒绝
              </Button>
            </div>
          </form>
        </FormProvider>
      </ResponsiveSheet>
    </>
  )
}

function ReviewRow({
  review,
  isSelected,
  showSelect,
  onToggleSelect,
  onApprove,
  onReject,
}: {
  review: ReviewRequest
  isSelected: boolean
  showSelect: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <article className="shop-section flex !flex-row items-start gap-3">
      {showSelect ? (
        <RowSelectCheckbox ariaLabel="选择审核项" checked={isSelected} onChange={onToggleSelect} />
      ) : null}
      <div className="size-16 shrink-0 overflow-hidden rounded-shop-sm bg-shop-bg-tinted">
        {review.listing.image_url ? (
          <img alt="" className="size-full object-cover" src={review.listing.image_url} />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Link
          className="line-clamp-1 text-[14px] font-medium text-shop-text-primary transition hover:text-shop-primary"
          href={`/listings/${review.listing.id}`}
          target="_blank"
        >
          {review.listing.title}
        </Link>
        <span className="text-[12px] text-shop-text-tertiary">
          卖家 {review.seller.name} · 提交于 {formatDateTime(review.created_at)}
        </span>
        {review.reject_reason ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>拒绝原因：{review.reject_reason}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </div>
      {review.status === "pending" ? (
        <div className="flex flex-col items-end gap-2">
          <Button onPress={onApprove} size="sm" variant="primary">
            通过
          </Button>
          <Button onPress={onReject} size="sm" variant="ghost">
            拒绝
          </Button>
        </div>
      ) : null}
    </article>
  )
}
