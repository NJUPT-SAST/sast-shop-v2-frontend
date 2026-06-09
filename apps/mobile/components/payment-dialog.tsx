"use client"

import { useRef, useState, type TouchEvent } from "react"
import {
  RiAlipayLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiKey2Line,
  RiQrCodeLine,
  RiQrScan2Line,
  RiWallet3Line,
  RiWechatPayLine,
} from "@remixicon/react"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

import { openPaymentScanner } from "@/lib/payment-app-links"
import type { PaymentPlatform } from "@/lib/payment-preferences"
import { PaymentQrCode } from "./payment-qr-code"

export type PaymentDialogStatus = "loading" | "ready" | "submitted" | "error"

export type PaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  amountCents: number
  verifyCode: string
  qrCodes: Partial<Record<PaymentPlatform, string>>
  defaultPlatform: PaymentPlatform
  status: PaymentDialogStatus
  errorMessage?: string
  submitting?: boolean
  onPay: (platform: PaymentPlatform) => void | Promise<void>
  onCancelPayment: () => void
  onRetry?: () => void
}

const PAYMENT_PLATFORMS: Array<{
  platform: PaymentPlatform
  label: string
  icon: typeof RiWechatPayLine
}> = [
  { platform: "wechat", label: "微信支付", icon: RiWechatPayLine },
  { platform: "alipay", label: "支付宝", icon: RiAlipayLine },
]

export function PaymentDialog({
  open,
  onOpenChange,
  ...props
}: PaymentDialogProps) {
  return (
    <ResponsiveDialog forceDrawer open={open} onOpenChange={onOpenChange}>
      {open ? <PaymentDialogBody key={props.defaultPlatform} {...props} /> : null}
    </ResponsiveDialog>
  )
}

function PaymentDialogBody({
  amountCents,
  verifyCode,
  qrCodes,
  defaultPlatform,
  status,
  errorMessage,
  submitting = false,
  onPay,
  onCancelPayment,
  onRetry,
}: Omit<PaymentDialogProps, "open" | "onOpenChange">) {
  const [platform, setPlatform] = useState<PaymentPlatform>(defaultPlatform)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const qrCodeContent = qrCodes[platform]
  const hasQrCode = Boolean(qrCodeContent)

  function openScanner() {
    if (!qrCodeContent) {
      toast.error("当前支付方式暂无收款码")
      return
    }

    try {
      openPaymentScanner(platform)
    } catch {
      toast.error("无法打开支付 App，请手动打开扫一扫")
    }
  }

  function handlePay() {
    if (!qrCodeContent || submitting || status !== "ready") {
      return
    }

    try {
      void Promise.resolve(onPay(platform)).catch(() => {
        toast.error("支付提交失败，请稍后再试")
      })
    } catch {
      toast.error("支付提交失败，请稍后再试")
    }
  }

  function switchPlatform(direction: 1 | -1) {
    const currentIndex = PAYMENT_PLATFORMS.findIndex(
      (item) => item.platform === platform
    )
    const nextIndex =
      (currentIndex + direction + PAYMENT_PLATFORMS.length) %
      PAYMENT_PLATFORMS.length
    const nextPlatform = PAYMENT_PLATFORMS[nextIndex]?.platform

    if (nextPlatform) {
      setPlatform(nextPlatform)
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]

    if (!touch) {
      return
    }

    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current
    const touch = event.changedTouches[0]

    touchStartRef.current = null

    if (!start || !touch) {
      return
    }

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) {
      return
    }

    switchPlatform(deltaX < 0 ? 1 : -1)
  }

  return (
    <ResponsiveDialogContent className="max-h-[88dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
      <ResponsiveDialogHeader className="px-0 text-left">
        <ResponsiveDialogTitle className="text-lg">支付</ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="leading-6">
          请核对金额、支付方式和付款标识码，付款后点击我已支付。
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex min-h-0 flex-col overflow-y-auto py-1">
        {status === "loading" ? <PaymentDialogSkeleton /> : null}
        {status === "error" ? (
          <Empty
            icon={<RiQrCodeLine className="size-5" />}
            title="获取支付账单失败"
            description={errorMessage ?? "请稍后重试，或联系发布者确认收款信息。"}
            action={
              onRetry ? (
                <Button type="button" variant="outline" onClick={onRetry}>
                  重试
                </Button>
              ) : null
            }
          />
        ) : null}
        {status === "submitted" ? (
          <Empty
            icon={<RiCheckboxCircleLine className="size-5 text-primary" />}
            title="已提交支付确认"
            description="订单已进入待确认收款状态，请等待发布者核验。"
          />
        ) : null}
        {status === "ready" ? (
          <Tabs
            value={platform}
            onValueChange={(value) => setPlatform(value as PaymentPlatform)}
            className="min-h-0"
          >
            <TabsList className="grid w-full grid-cols-2">
              {PAYMENT_PLATFORMS.map(({ platform: value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon data-icon="inline-start" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {PAYMENT_PLATFORMS.map(({ platform: value, label, icon: Icon }) => {
              const panelQrCodeContent = qrCodes[value]
              const panelHasQrCode = Boolean(panelQrCodeContent)

              return (
                <TabsContent key={value} value={value} className="mt-4">
                  <div
                    className="flex flex-col gap-4"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-4">
                      {panelQrCodeContent ? (
                        <PaymentQrCode content={panelQrCodeContent} channel={value} />
                      ) : (
                        <Empty
                          icon={<RiQrCodeLine className="size-5" />}
                          title="暂无收款码"
                          description={`发布者还没有配置${label}收款码。`}
                          className="w-full border bg-white"
                        />
                      )}
                      <Badge
                        variant={panelHasQrCode ? "secondary" : "destructive"}
                        className="max-w-full justify-center"
                      >
                        <Icon className="size-3.5" />
                        <span className="truncate">
                          {panelHasQrCode
                            ? `${label}收款码`
                            : "当前支付方式暂无收款码"}
                        </span>
                      </Badge>
                    </div>

                    <PaymentBillSummary
                      amountCents={amountCents}
                      verifyCode={verifyCode}
                    />

                    <Separator />

                    <Button
                      type="button"
                      variant="outline"
                      disabled={!panelHasQrCode}
                      onClick={openScanner}
                    >
                      <RiQrScan2Line data-icon="inline-start" />
                      打开扫一扫
                    </Button>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        ) : null}
      </div>

      <ResponsiveDialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancelPayment}>
          <RiCloseCircleLine data-icon="inline-start" />
          取消支付
        </Button>
        <Button
          type="button"
          className={cn(platform === "wechat" && "bg-green-600 hover:bg-green-700")}
          disabled={!hasQrCode || submitting || status !== "ready"}
          onClick={handlePay}
        >
          <RiCheckboxCircleLine data-icon="inline-start" />
          {submitting ? "提交中" : "我已支付"}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialogContent>
  )
}

function PaymentDialogSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-4">
        <Skeleton className="size-44 rounded-lg" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 rounded-md" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  )
}

function PaymentBillSummary({
  amountCents,
  verifyCode,
}: {
  amountCents: number
  verifyCode: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RiWallet3Line className="size-5 text-primary" />
          <span className="text-sm text-muted-foreground">金额</span>
        </div>
        <span className="text-xl font-semibold text-primary">
          {formatPrice(amountCents)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <RiKey2Line className="size-5 text-primary" />
          <span className="text-sm text-muted-foreground">标识码</span>
        </div>
        <span className="break-all text-right font-mono text-2xl font-semibold tracking-[0.2em]">
          {verifyCode}
        </span>
      </div>
    </div>
  )
}
