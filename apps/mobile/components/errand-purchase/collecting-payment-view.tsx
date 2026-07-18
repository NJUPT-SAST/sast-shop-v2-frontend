"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react"
import {
  confirmBill,
  transitionToCompleted,
  type CollectingPaymentBill,
  type CollectingPaymentDetail,
  type DataSource,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { toast } from "sonner"

import { MobileFixedFooter } from "@/components/mobile-fixed-footer"

export type CollectingPaymentViewProps = {
  dataSource: DataSource
  connectBaseUrl: string
  detail: CollectingPaymentDetail
  taskId: string
}

type DialogState =
  | { type: "none" }
  | { type: "confirm_complete" }

function getStatusBadge(status: CollectingPaymentBill["paymentStatus"]) {
  switch (status) {
    case "pending_confirmation":
      return <Badge className="shrink-0">待确认</Badge>
    case "pending":
      return <Badge variant="secondary" className="shrink-0">未支付</Badge>
    case "confirmed":
      return <Badge variant="outline" className="shrink-0">已收款</Badge>
    case "problem":
      return <Badge variant="destructive" className="shrink-0">问题</Badge>
    default:
      return <Badge variant="outline" className="shrink-0">未知</Badge>
  }
}

export function CollectingPaymentView({
  dataSource,
  connectBaseUrl,
  detail,
  taskId,
}: CollectingPaymentViewProps) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const confirmingRef = useRef(false)
  const [bills, setBills] = useState<CollectingPaymentBill[]>(detail.bills)
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ type: "none" })
  const [submitting, setSubmitting] = useState(false)
  const [confirmingBillId, setConfirmingBillId] = useState<string | null>(null)

  const serviceOptions = { dataSource, connectBaseUrl }

  const pendingConfirmation = bills.filter(
    (b) => b.paymentStatus === "pending_confirmation"
  )
  const unpaid = bills.filter((b) => b.paymentStatus === "pending")
  const confirmed = bills.filter((b) => b.paymentStatus === "confirmed")

  const confirmedCount = confirmed.length
  const totalCount = bills.length
  const allConfirmed = confirmedCount === totalCount && totalCount > 0

  const updateBill = (requesterId: string, status: CollectingPaymentBill["paymentStatus"]) => {
    setBills((prev) =>
      prev.map((b) =>
        b.requesterId === requesterId ? { ...b, paymentStatus: status } : b
      )
    )
  }

  const handleConfirmBill = async (bill: CollectingPaymentBill) => {
    if (!bill.billId) {
      toast.error("账单 ID 不存在")
      return
    }
    if (!bill.billUpdatedAt) {
      toast.error("账单状态已过期，请刷新后重试")
      return
    }
    if (confirmingRef.current) return
    confirmingRef.current = true
    setConfirmingBillId(bill.requesterId)
    try {
      await confirmBill(
        { billId: bill.billId, updatedAt: bill.billUpdatedAt },
        serviceOptions
      )
      updateBill(bill.requesterId, "confirmed")
    } catch {
      toast.error("确认收款失败，请稍后再试")
    } finally {
      confirmingRef.current = false
      setConfirmingBillId(null)
    }
  }

  const handleMarkProblem = (bill: CollectingPaymentBill) => {
    updateBill(bill.requesterId, "problem")
    toast.info("已标记为问题账单")
  }

  const handleComplete = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await transitionToCompleted(taskId, null, serviceOptions)
      setDialog({ type: "none" })
      router.push("/group")
    } catch {
      toast.error("操作失败，请稍后再试")
      setSubmitting(false)
    } finally {
      submittingRef.current = false
    }
  }

  const renderBillSection = (
    list: CollectingPaymentBill[],
    title: string
  ) => {
    if (list.length === 0) return null
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {title} ({list.length})
        </h2>
        <div className="flex flex-col gap-3">
          {list.map((bill) => {
            const expandKey = bill.billId ?? bill.requesterId
            const isExpanded = expandedBillId === expandKey
            return (
              <div key={expandKey} className="rounded-lg border bg-card overflow-hidden">
                <button
                  type="button"
                  aria-controls={`payment-bill-${expandKey}`}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setExpandedBillId(isExpanded ? null : expandKey)
                  }
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage
                      src={bill.requesterAvatarUrl}
                      alt={bill.requesterName}
                    />
                    <AvatarFallback className="text-sm">
                      {bill.requesterName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {bill.requesterName}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-primary">
                      {formatPrice(bill.totalAmountCents)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {getStatusBadge(bill.paymentStatus)}
                    {isExpanded ? (
                      <RiArrowUpSLine className="size-4 text-muted-foreground" />
                    ) : (
                      <RiArrowDownSLine className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div
                    id={`payment-bill-${expandKey}`}
                    className="border-t px-3 pb-3"
                  >
                    <div className="mt-3 flex flex-col gap-2">
                      {bill.items.map((item) => (
                        <div
                          key={item.errandDemandItemId}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 truncate text-muted-foreground">
                            {item.title} × {item.distributedQuantity}
                          </span>
                          <span className="shrink-0 font-medium">
                            {formatPrice(item.subtotalCents)}
                          </span>
                        </div>
                      ))}
                      <div className="mt-1 border-t pt-2 flex flex-col gap-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">商品费</span>
                          <span>{formatPrice(bill.productAmountCents)}</span>
                        </div>
                        {bill.serviceFeeAmountCents > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">跑腿费</span>
                            <span>{formatPrice(bill.serviceFeeAmountCents)}</span>
                          </div>
                        )}
                        {bill.packagingFeeShareCents > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">包装费</span>
                            <span>{formatPrice(bill.packagingFeeShareCents)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold">
                          <span>合计</span>
                          <span className="text-primary">
                            {formatPrice(bill.totalAmountCents)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {bill.paymentStatus === "pending_confirmation" && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="touch"
                          variant="outline"
                          className="flex-1 text-destructive"
                          onClick={() => handleMarkProblem(bill)}
                          disabled={confirmingBillId === bill.requesterId}
                        >
                          标记问题
                        </Button>
                        <Button
                          type="button"
                          size="touch"
                          className="flex-1"
                          onClick={() => void handleConfirmBill(bill)}
                          disabled={confirmingBillId === bill.requesterId}
                        >
                          {confirmingBillId === bill.requesterId
                            ? "处理中"
                            : "确认收款"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-5 pb-24">
      <section className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold leading-7">支付核对</h1>
        <Badge className="shrink-0">收款中</Badge>
      </section>

      {renderBillSection(pendingConfirmation, "待确认")}
      {renderBillSection(unpaid, "未支付")}
      {renderBillSection(confirmed, "已收款")}

      {bills.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground text-sm">
          暂无账单
        </div>
      )}

      <MobileFixedFooter>
        <Button
          type="button"
          disabled={!allConfirmed}
          className="h-12 w-full"
          onClick={() => setDialog({ type: "confirm_complete" })}
        >
          订单完成 ({confirmedCount}/{totalCount})
        </Button>
      </MobileFixedFooter>

      <ResponsiveDialog
        open={dialog.type === "confirm_complete"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" })
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认订单完成</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              所有买家均已收款，确认标记订单为完成状态。
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
              disabled={submitting}
              onClick={() => void handleComplete()}
            >
              {submitting ? "处理中" : "确认完成"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
