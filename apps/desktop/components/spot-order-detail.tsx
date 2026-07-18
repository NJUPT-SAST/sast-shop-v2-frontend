"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RiArrowLeftLine, RiCheckboxCircleLine } from "@remixicon/react"
import {
  cancelSpotOrder,
  completeSpotOrder,
  confirmBill,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type DataSource,
  type PaymentQrChannel,
  type SpotOrder,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import { QRCodeCanvas } from "qrcode.react"
import { toast } from "sonner"

import { getSpotOrderStatusLabel, reconcileSpotOrderUpdate, resolveSpotOrderActions, type SpotOrderView } from "@/lib/spot-orders"
import { ManagedImage } from "./managed-image"

type ConfirmationAction = "cancel" | "complete" | "confirm" | null

export function SpotOrderDetail({
  dataSource,
  connectBaseUrl,
  order,
  view,
  returnTo,
}: {
  dataSource: DataSource
  connectBaseUrl: string
  order: SpotOrder
  view: SpotOrderView
  returnTo: string
}) {
  const router = useRouter()
  const [currentOrder, setCurrentOrder] = useState(order)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationAction>(null)
  const [supplementOpen, setSupplementOpen] = useState(false)
  const [serialNumber, setSerialNumber] = useState("")
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const resolvedOrder = reconcileSpotOrderUpdate(currentOrder, order)
  const bill = resolvedOrder.bill
  const actions = resolveSpotOrderActions(view, resolvedOrder.status, bill?.status)
  const steps = view === "seller" ? ["待收款", "后续处理", "已完成"] : ["待支付", "处理中", "已完成"]
  const activeStep = resolvedOrder.status === "pending_payment" ? 0 : resolvedOrder.status === "paid" ? 1 : resolvedOrder.status === "completed" ? 2 : -1

  async function mutate(action: Exclude<ConfirmationAction, null>) {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    try {
      if (action === "cancel") {
        setCurrentOrder(await cancelSpotOrder({ spotOrderId: resolvedOrder.id }, { dataSource, connectBaseUrl }))
        toast.success("订单已取消")
      } else if (action === "complete") {
        setCurrentOrder(await completeSpotOrder({ spotOrderId: resolvedOrder.id }, { dataSource, connectBaseUrl }))
        toast.success("订单已完成")
      } else if (bill?.updatedAt) {
        const updatedBill = await confirmBill({ billId: bill.id, updatedAt: bill.updatedAt }, { dataSource, connectBaseUrl })
        setCurrentOrder((value) => ({ ...value, bill: updatedBill }))
        toast.success("已确认收款")
      }
      setConfirmation(null)
      router.refresh()
    } catch {
      toast.error("操作失败，订单状态可能已变化，请刷新后重试")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  async function supplement() {
    if (!bill?.updatedAt || !serialNumber.trim() || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    try {
      const updatedBill = await supplementBillSerialNumber(
        { billId: bill.id, serialNumber: serialNumber.trim(), updatedAt: bill.updatedAt },
        { dataSource, connectBaseUrl },
      )
      setCurrentOrder((value) => ({ ...value, bill: updatedBill }))
      setSupplementOpen(false)
      toast.success("支付流水号已补充")
      router.refresh()
    } catch {
      toast.error("提交失败，请刷新账单状态后重试")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" asChild className="-ml-3 mb-2"><Link href={returnTo}><RiArrowLeftLine />返回订单</Link></Button>
          <div className="flex min-w-0 items-center gap-3"><h1 className="truncate text-3xl font-semibold tracking-tight">订单详情</h1><Badge variant={resolvedOrder.status === "completed" ? "success" : resolvedOrder.status === "cancelled" ? "neutral" : "payment"}>{getSpotOrderStatusLabel(view, resolvedOrder.status, bill?.status)}</Badge></div>
          <p className="mt-2 truncate text-sm text-muted-foreground">订单号 {resolvedOrder.orderNo || resolvedOrder.id}</p>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-3 gap-0 p-5">
          {steps.map((step, index) => <div key={step} className="relative flex items-center gap-3 pr-4 last:pr-0"><span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm", index <= activeStep && "border-primary bg-primary text-primary-foreground")}>{index < activeStep ? <RiCheckboxCircleLine className="size-4" /> : index + 1}</span><span className={cn("text-sm", index === activeStep ? "font-semibold" : "text-muted-foreground")}>{step}</span>{index < steps.length - 1 ? <span className={cn("absolute left-8 right-0 top-4 h-px bg-border", index < activeStep && "bg-primary")} /> : null}</div>)}
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] items-start gap-5">
        <Card>
          <CardHeader><CardTitle>商品与订单信息</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex min-w-0 gap-4"><ManagedImage src={resolvedOrder.productImageUrl} alt={resolvedOrder.productTitle} className="size-28 shrink-0 rounded-lg" /><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{resolvedOrder.productTitle}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{resolvedOrder.productDescription || "暂无商品说明"}</p><p className="mt-4 text-sm">{formatPrice(resolvedOrder.unitPriceCents)} × {resolvedOrder.quantity}</p></div><p className="shrink-0 text-xl font-semibold">{formatPrice(resolvedOrder.totalAmountCents)}</p></div>
            <Separator />
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm"><dt className="text-muted-foreground">店铺</dt><dd className="truncate">{resolvedOrder.store?.name ?? "—"}</dd><dt className="text-muted-foreground">店铺地址</dt><dd>{resolvedOrder.store?.address || "—"}</dd><dt className="text-muted-foreground">卖家</dt><dd>{resolvedOrder.seller?.name ?? "—"}</dd><dt className="text-muted-foreground">创建时间</dt><dd>{formatDate(resolvedOrder.createdAt)}</dd></dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>支付信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {bill ? <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm"><dt className="text-muted-foreground">应付金额</dt><dd className="font-semibold">{formatPrice(bill.amountCents)}</dd><dt className="text-muted-foreground">收款方</dt><dd className="truncate">{bill.payee?.name ?? "—"}</dd><dt className="text-muted-foreground">核验码</dt><dd className="font-mono text-lg font-semibold tracking-widest">{bill.verifyCode || "—"}</dd><dt className="text-muted-foreground">流水号</dt><dd className="break-all">{bill.serialNumber || "—"}</dd></dl> : <p className="text-sm text-muted-foreground">账单尚未生成。</p>}
            <div className="flex flex-wrap gap-2">
              {actions.canPay ? <Button onClick={() => setPaymentOpen(true)} disabled={!bill?.updatedAt || !bill.payee?.id}>立即支付</Button> : null}
              {actions.canSupplementSerialNumber ? <Button variant="outline" onClick={() => setSupplementOpen(true)}>补充流水号</Button> : null}
              {actions.canConfirmPayment ? <Button onClick={() => setConfirmation("confirm")} disabled={!bill?.updatedAt}>确认收款</Button> : null}
              {actions.canComplete ? <Button onClick={() => setConfirmation("complete")}>确认完成</Button> : null}
              {actions.canCancel ? <Button variant="outline" onClick={() => setConfirmation("cancel")}>取消订单</Button> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} order={resolvedOrder} dataSource={dataSource} connectBaseUrl={connectBaseUrl} onPaid={(updatedBill) => { setCurrentOrder((value) => ({ ...value, bill: updatedBill })); router.refresh() }} />

      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && !pending && setConfirmation(null)}><DialogContent><DialogHeader><DialogTitle>{confirmation === "cancel" ? "确认取消订单？" : confirmation === "complete" ? "确认订单已完成？" : "确认已收到款项？"}</DialogTitle><DialogDescription>提交后将更新真实订单状态，请先核对商品、金额和核验码。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={pending}>返回检查</Button><Button onClick={() => confirmation && mutate(confirmation)} disabled={pending}>{pending ? <Spinner /> : null}确认提交</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={supplementOpen} onOpenChange={(open) => !pending && setSupplementOpen(open)}><DialogContent><DialogHeader><DialogTitle>补充支付流水号</DialogTitle><DialogDescription>仅在已经支付但缺少流水号时填写。</DialogDescription></DialogHeader><Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="请输入支付流水号" /><DialogFooter><Button variant="outline" onClick={() => setSupplementOpen(false)} disabled={pending}>取消</Button><Button onClick={supplement} disabled={pending || !serialNumber.trim()}>{pending ? <Spinner /> : null}提交</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

function PaymentDialog({
  open,
  onOpenChange,
  order,
  dataSource,
  connectBaseUrl,
  onPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: SpotOrder
  dataSource: DataSource
  connectBaseUrl: string
  onPaid: (bill: NonNullable<SpotOrder["bill"]>) => void
}) {
  const [channel, setChannel] = useState<PaymentQrChannel>("wechat")
  const [codes, setCodes] = useState<Partial<Record<PaymentQrChannel, string>>>({})
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const loadedForRef = useRef<string | null>(null)
  const payingRef = useRef(false)
  const bill = order.bill

  useEffect(() => {
    const payeeId = bill?.payee?.id
    if (!open || !payeeId || loadedForRef.current === payeeId) return
    let cancelled = false
    setLoading(true)
    void listPaymentQrCodes({ dataSource, connectBaseUrl, ownerId: payeeId })
      .then((result) => {
        if (cancelled) return
        const mapped = Object.fromEntries(result.map((item) => [item.channel, item.content])) as Partial<Record<PaymentQrChannel, string>>
        setCodes(mapped)
        setChannel(mapped.wechat ? "wechat" : "alipay")
        loadedForRef.current = payeeId
      })
      .catch(() => {
        if (!cancelled) toast.error("收款码加载失败，请稍后重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bill?.payee?.id, connectBaseUrl, dataSource, open])

  async function submitPayment() {
    if (!bill?.updatedAt || !codes[channel] || payingRef.current) return
    payingRef.current = true
    setPaying(true)
    try {
      const updated = await payBill({ billId: bill.id, channel, updatedAt: bill.updatedAt }, { dataSource, connectBaseUrl })
      onPaid(updated)
      onOpenChange(false)
      toast.success("已提交支付，等待卖家确认")
    } catch {
      toast.error("支付提交失败，请检查账单状态后重试")
    } finally {
      payingRef.current = false
      setPaying(false)
    }
  }

  const content = codes[channel]
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>扫码支付 {formatPrice(bill?.amountCents ?? order.totalAmountCents)}</DialogTitle><DialogDescription>请核对收款方和核验码，扫码完成后点击“我已支付”。</DialogDescription></DialogHeader><Tabs value={channel} onValueChange={(value) => setChannel(value as PaymentQrChannel)}><TabsList className="w-full"><TabsTrigger value="wechat" disabled={!codes.wechat}>微信</TabsTrigger><TabsTrigger value="alipay" disabled={!codes.alipay}>支付宝</TabsTrigger></TabsList></Tabs><div className="flex min-h-64 items-center justify-center rounded-xl bg-white p-5">{loading ? <Spinner className="text-primary" /> : content ? <QRCodeCanvas value={content} size={220} level="M" /> : <p className="text-sm text-muted-foreground">暂无可用收款码</p>}</div><div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm"><span className="text-muted-foreground">核验码</span><span className="font-mono text-lg font-semibold tracking-widest">{bill?.verifyCode || "—"}</span></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>稍后支付</Button><Button onClick={submitPayment} disabled={paying || !content || !bill?.updatedAt}>{paying ? <Spinner /> : null}我已支付</Button></DialogFooter></DialogContent></Dialog>
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}
