"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiQuestionLine,
} from "@remixicon/react"
import {
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type DataSource,
  type PaymentBill,
  type PaymentQrCode,
  type SpotOrder,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

import type { PaymentPlatform } from "@/lib/payment-preferences"
import { PaymentDialog, type PaymentDialogStatus } from "./payment-dialog"

export type SpotOrderDetailProps = {
  dataSource: DataSource
  connectBaseUrl: string
  order: SpotOrder
}

type OrderStep = {
  label: string
  isActive: boolean
  isDone: boolean
}

const STATUS_STEP_INDEX: Record<SpotOrder["status"], number> = {
  pending_payment: 0,
  paid: 1,
  completed: 2,
  cancelled: -1,
  unknown: -1,
}

const STATUS_LABEL: Record<SpotOrder["status"], string> = {
  pending_payment: "待支付",
  paid: "处理中",
  completed: "已完成",
  cancelled: "已取消",
  unknown: "未知",
}

const STEP_LABELS = ["待支付", "处理中", "已完成"]

function buildSteps(status: SpotOrder["status"]): OrderStep[] {
  const activeIndex = STATUS_STEP_INDEX[status]

  return STEP_LABELS.map((label, index) => ({
    label,
    isDone: activeIndex > index,
    isActive: activeIndex === index,
  }))
}

export function SpotOrderDetail({
  dataSource,
  connectBaseUrl,
  order,
}: SpotOrderDetailProps) {
  const router = useRouter()
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false)
  const [progressDrawerOpen, setProgressDrawerOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const steps = buildSteps(order.status)
  const isCancelled = order.status === "cancelled"
  const isPendingPayment = order.status === "pending_payment"

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="返回"
          >
            <RiArrowLeftLine className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">订单详情</h1>
        </div>

        <OrderProgressBar
          steps={steps}
          status={order.status}
          isCancelled={isCancelled}
          onExpand={() => setProgressDrawerOpen(true)}
        />

        <OrderInfoCard order={order} />

        {order.status === "paid" && order.bill ? (
          <PaidStatusSection bill={order.bill} />
        ) : null}

        {order.status === "completed" ? (
          <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
            <RiCheckboxCircleLine className="size-5 shrink-0 text-green-600" />
            <span className="text-sm font-medium">订单已完成</span>
          </div>
        ) : null}

        {isCancelled ? (
          <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
            <RiCloseCircleLine className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">订单已取消</span>
          </div>
        ) : null}
      </div>

      {isPendingPayment ? (
        <div className="sticky bottom-0 flex gap-2 border-t bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setCancelDialogOpen(true)}
          >
            取消订单
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => setPaymentDrawerOpen(true)}
          >
            去支付
          </Button>
        </div>
      ) : null}

      <OrderProgressDrawer
        open={progressDrawerOpen}
        onOpenChange={setProgressDrawerOpen}
        steps={steps}
        isCancelled={isCancelled}
      />

      {isPendingPayment && order.bill ? (
        <PaymentSection
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          order={order}
          bill={order.bill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={() => {
            setPaymentDrawerOpen(false)
            router.refresh()
          }}
        />
      ) : null}

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
      />
    </div>
  )
}

function OrderProgressBar({
  steps,
  status,
  isCancelled,
  onExpand,
}: {
  steps: OrderStep[]
  status: SpotOrder["status"]
  isCancelled: boolean
  onExpand: () => void
}) {
  const currentLabel = STATUS_LABEL[status]

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left"
      onClick={onExpand}
    >
      <div className="flex items-center gap-3">
        {isCancelled ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted">
            <RiCloseCircleLine className="size-4 text-muted-foreground" />
          </span>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <RiCheckboxCircleLine className="size-4 text-primary" />
          </span>
        )}
        <div>
          <p className="text-sm font-medium">{currentLabel}</p>
          {!isCancelled ? (
            <p className="text-xs text-muted-foreground">
              {steps.filter((s) => s.isDone || s.isActive).length} / {steps.length} 步骤
            </p>
          ) : null}
        </div>
      </div>
      <RiQuestionLine className="size-4 text-muted-foreground" />
    </button>
  )
}

function OrderProgressDrawer({
  open,
  onOpenChange,
  steps,
  isCancelled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: OrderStep[]
  isCancelled: boolean
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>订单进度</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {isCancelled ? (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                  <RiCloseCircleLine className="size-4 text-muted-foreground" />
                </span>
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-medium text-muted-foreground">已取消</p>
                <p className="mt-0.5 text-xs text-muted-foreground">订单已取消</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full",
                        step.isDone
                          ? "bg-green-100 text-green-600"
                          : step.isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step.isDone ? (
                        <RiCheckboxCircleLine className="size-4" />
                      ) : (
                        <span className="text-xs font-semibold">{index + 1}</span>
                      )}
                    </span>
                    {index < steps.length - 1 ? (
                      <span
                        className={cn(
                          "my-1 w-0.5 flex-1",
                          step.isDone ? "bg-green-200" : "bg-muted"
                        )}
                        style={{ minHeight: "1.5rem" }}
                      />
                    ) : null}
                  </div>
                  <div className="pb-4 pt-0.5">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.isActive
                          ? "text-foreground"
                          : step.isDone
                            ? "text-green-600"
                            : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </p>
                    {step.isActive ? (
                      <p className="mt-0.5 text-xs text-primary">当前状态</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function OrderInfoCard({ order }: { order: SpotOrder }) {
  const lineTotal = order.unitPriceCents * order.quantity

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">订单信息</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">订单号</span>
          <span className="font-mono text-xs">{order.orderNo}</span>
        </div>
        {order.store ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">店铺</span>
            <span>{order.store.name}</span>
          </div>
        ) : null}
        <Separator />
        <div className="flex items-start gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-sm font-medium">{order.productTitle}</p>
            {order.productDescription ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {order.productDescription}
              </p>
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {formatPrice(order.unitPriceCents)} × {order.quantity}
              </span>
              <span className="font-medium">{formatPrice(lineTotal)}</span>
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">合计</span>
          <span className="text-base font-semibold text-primary">
            {formatPrice(order.totalAmountCents)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function PaidStatusSection({ bill }: { bill: PaymentBill }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">支付信息</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RiCheckboxCircleLine className="size-4 shrink-0 text-primary" />
          收款方将根据标识码核对收款信息
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm text-muted-foreground">标识码</span>
          <span className="cursor-default select-none font-mono text-sm blur-sm transition-all hover:blur-0">
            {bill.verifyCode}
          </span>
        </div>
        {bill.channel ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">支付方式</span>
            <span>{bill.channel === "wechat" ? "微信支付" : "支付宝"}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CancelOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>取消订单</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            如需取消订单，请联系发布者或等待订单自动关闭。目前暂不支持在线取消。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            知道了
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function SupplementSerialNumberDialog({
  open,
  onOpenChange,
  billId,
  billUpdatedAt,
  dataSource,
  connectBaseUrl,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: string
  billUpdatedAt: string | null
  dataSource: DataSource
  connectBaseUrl: string
  onSuccess: () => void
}) {
  const [serialNumber, setSerialNumber] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmed = serialNumber.trim()

    if (!trimmed) {
      toast.error("请输入支付流水号")
      return
    }

    setSubmitting(true)

    try {
      await supplementBillSerialNumber(
        { billId, serialNumber: trimmed, updatedAt: billUpdatedAt ?? undefined },
        { dataSource, connectBaseUrl }
      )
      toast.success("流水号已补充")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("提交失败，请稍后再试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>补充支付流水号</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            请在支付记录中找到流水号（交易单号），填写后发布者可以核对款项。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-4 pb-2">
          <Label htmlFor="serial-number" className="mb-1.5 block text-sm">
            支付流水号
          </Label>
          <Input
            id="serial-number"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="请输入支付流水号"
            className="font-mono"
          />
        </div>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "提交中" : "确认提交"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function PaymentSection({
  open,
  onOpenChange,
  order,
  bill,
  dataSource,
  connectBaseUrl,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: SpotOrder
  bill: PaymentBill
  dataSource: DataSource
  connectBaseUrl: string
  onSuccess: () => void
}) {
  const [supplementOpen, setSupplementOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dialogStatus, setDialogStatus] = useState<PaymentDialogStatus>("loading")
  const [qrCodes, setQrCodes] = useState<Partial<Record<PaymentPlatform, string>>>({})
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const payeeId = bill.payee?.id
  const loadCounterRef = useRef(0)

  async function fetchQrCodes() {
    const generation = ++loadCounterRef.current

    setDialogStatus("loading")
    setErrorMessage(undefined)

    try {
      const codes: PaymentQrCode[] = await listPaymentQrCodes(
        { dataSource, connectBaseUrl, ownerId: payeeId }
      )

      if (generation !== loadCounterRef.current) return

      const qrMap: Partial<Record<PaymentPlatform, string>> = {}

      for (const code of codes) {
        qrMap[code.channel] = code.content
      }

      setQrCodes(qrMap)
      setDialogStatus("ready")
    } catch {
      if (generation !== loadCounterRef.current) return
      setErrorMessage("获取收款码失败，请稍后重试")
      setDialogStatus("error")
    }
  }

  useEffect(() => {
    if (!open) return
    const timeoutId = window.setTimeout(() => {
      void fetchQrCodes()
    }, 0)
    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataSource, connectBaseUrl, payeeId])

  const defaultPlatform: PaymentPlatform =
    (bill.channel as PaymentPlatform | null) ?? "wechat"

  async function handlePay(platform: PaymentPlatform) {
    setSubmitting(true)

    try {
      await payBill(
        { billId: bill.id, channel: platform, updatedAt: bill.updatedAt ?? undefined },
        { dataSource, connectBaseUrl }
      )
      setDialogStatus("submitted")
      onSuccess()
    } catch {
      toast.error("提交支付失败，请稍后再试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PaymentDialog
        open={open}
        onOpenChange={onOpenChange}
        amountCents={order.totalAmountCents}
        verifyCode={bill.verifyCode}
        qrCodes={qrCodes}
        defaultPlatform={defaultPlatform}
        status={dialogStatus}
        errorMessage={errorMessage}
        submitting={submitting}
        onPay={handlePay}
        onCancelPayment={() => onOpenChange(false)}
        onRetry={() => void fetchQrCodes()}
      />

      <SupplementSerialNumberDialog
        open={supplementOpen}
        onOpenChange={setSupplementOpen}
        billId={bill.id}
        billUpdatedAt={bill.updatedAt}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        onSuccess={onSuccess}
      />
    </>
  )
}
