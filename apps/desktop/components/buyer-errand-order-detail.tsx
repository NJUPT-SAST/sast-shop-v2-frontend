"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiTimeLine,
} from "@remixicon/react"
import {
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type BuyerErrandOrderDetail,
  type BuyerErrandOrderProductItem,
  type DataSource,
  type PaymentBill,
  type PaymentQrChannel,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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

import {
  getBuyerErrandOrderAdjustmentCents,
  getBuyerErrandOrderAmountCents,
  reconcileBuyerErrandOrderUpdate,
  resolveBuyerErrandPaymentState,
} from "@/lib/buyer-errand-order"
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/order-filters"
import { ManagedImage } from "./managed-image"

export function BuyerErrandOrderDetailView({
  order,
  dataSource,
  connectBaseUrl,
}: {
  order: BuyerErrandOrderDetail
  dataSource: DataSource
  connectBaseUrl?: string
}) {
  const router = useRouter()
  const [currentOrder, setCurrentOrder] = useState(order)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [supplementOpen, setSupplementOpen] = useState(false)
  const resolvedOrder = reconcileBuyerErrandOrderUpdate(currentOrder, order)
  const bill = resolvedOrder.bill
  const paymentState = resolveBuyerErrandPaymentState(resolvedOrder.status, bill)
  const canSupplement = Boolean(
    paymentState === "submitted" && bill?.updatedAt && !bill.serialNumber,
  )

  function updateBill(updatedBill: PaymentBill) {
    setCurrentOrder({ ...resolvedOrder, bill: updatedBill })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="-ml-3 mb-2">
            <Link href="/orders?type=errand&view=participant">
              <RiArrowLeftLine data-icon="inline-start" />
              返回跑腿订单
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              跑腿订单详情
            </h1>
            <Badge
              variant={getStatusBadgeVariant(resolvedOrder.status)}
              className="shrink-0"
            >
              {getStatusLabel(resolvedOrder.status)}
            </Badge>
          </div>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {resolvedOrder.store?.name ?? "跑腿店铺"} · 订单 #{resolvedOrder.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {paymentState === "payable" && bill ? (
            <Button onClick={() => setPaymentOpen(true)}>
              去支付
            </Button>
          ) : null}
          {canSupplement ? (
            <Button variant="outline" onClick={() => setSupplementOpen(true)}>
              补充流水号
            </Button>
          ) : null}
        </div>
      </section>

      <StatusNotice order={resolvedOrder} paymentState={paymentState} />
      <ProgressSteps order={resolvedOrder} />

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)]">
        <ProductItemsCard items={resolvedOrder.productItems} />
        <div className="grid min-w-0 gap-5">
          <OrderInfoCard order={resolvedOrder} />
          {resolvedOrder.captain ? (
            <Card>
              <CardHeader><CardTitle>采购团长</CardTitle></CardHeader>
              <CardContent className="flex min-w-0 items-center gap-3">
                <Avatar className="size-11">
                  <AvatarImage
                    src={resolvedOrder.captain.avatarUrl}
                    alt={resolvedOrder.captain.name}
                  />
                  <AvatarFallback>
                    {resolvedOrder.captain.name.trim().slice(0, 1) || "团"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{resolvedOrder.captain.name}</p>
                  <p className="text-sm text-muted-foreground">负责采购、分发与收款</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <AmountSummaryCard order={resolvedOrder} />
          {bill ? <BillCard bill={bill} /> : null}
        </div>
      </div>

      {paymentState === "payable" && bill ? (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          bill={bill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onPaid={updateBill}
        />
      ) : null}
      {canSupplement && bill?.updatedAt ? (
        <SupplementDialog
          open={supplementOpen}
          onOpenChange={setSupplementOpen}
          bill={bill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onUpdated={updateBill}
        />
      ) : null}
    </div>
  )
}

function StatusNotice({
  order,
  paymentState,
}: {
  order: BuyerErrandOrderDetail
  paymentState: ReturnType<typeof resolveBuyerErrandPaymentState>
}) {
  if (order.status === "open") {
    return <Alert><RiInformationLine /><AlertTitle>等待团长接单</AlertTitle><AlertDescription>尚未接单的商品会继续保留在跑腿大厅。</AlertDescription></Alert>
  }
  if (paymentState === "submitted") {
    return <Alert><RiTimeLine /><AlertTitle>付款信息已提交</AlertTitle><AlertDescription>请等待团长核对到账；必要时可补充支付流水号。</AlertDescription></Alert>
  }
  if (paymentState === "completed" || order.status === "completed") {
    return <Alert><RiCheckboxCircleLine /><AlertTitle>订单已完成</AlertTitle><AlertDescription>团长已确认收款，本次跑腿采购已完成。</AlertDescription></Alert>
  }
  if (order.status === "cancelled") {
    return <Alert><RiCloseCircleLine /><AlertTitle>订单已取消</AlertTitle><AlertDescription>这笔订单不再继续处理。</AlertDescription></Alert>
  }
  if (paymentState === "unavailable") {
    return <Alert variant="destructive"><RiErrorWarningLine /><AlertTitle>支付信息暂不可用</AlertTitle><AlertDescription>账单缺少收款人或版本信息，为避免付错款，当前不能支付。</AlertDescription></Alert>
  }
  return null
}

function ProgressSteps({ order }: { order: BuyerErrandOrderDetail }) {
  const steps = [
    { label: "发起需求", timestamp: order.createdAt },
    { label: "开始采购", timestamp: order.shoppingStartAt },
    { label: "完成采购", timestamp: order.shoppingCompletedAt },
    { label: "完成分发", timestamp: order.distributionCompletedAt },
    { label: "完成支付", timestamp: order.paymentCompletedAt },
  ]
  return (
    <Card>
      <CardContent className="grid grid-cols-5 gap-0 p-5">
        {steps.map((step, index) => {
          const completed = Boolean(step.timestamp)
          return (
            <div key={step.label} className="relative flex min-w-0 items-center gap-3 pr-4 last:pr-0">
              <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm", completed && "border-primary bg-primary text-primary-foreground")}>
                {completed ? <RiCheckboxCircleLine className="size-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("truncate text-sm", completed ? "font-medium" : "text-muted-foreground")}>{step.label}</p>
                <p className="truncate text-xs text-muted-foreground">{formatDateTime(step.timestamp)}</p>
              </div>
              {index < steps.length - 1 ? <span className={cn("absolute left-8 right-0 top-4 h-px bg-border", completed && "bg-primary")} /> : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ProductItemsCard({ items }: { items: BuyerErrandOrderProductItem[] }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader><CardTitle>商品明细</CardTitle><CardDescription>共 {items.length} 种商品</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">暂无商品明细</p> : items.map((item, index) => (
          <div key={item.demandItemId} className="grid gap-4">
            {index > 0 ? <Separator /> : null}
            <div className="flex min-w-0 gap-4">
              <ManagedImage src={item.productTemplate?.mainImageUrl} alt={item.productTemplate?.title ?? "商品"} className="size-24 shrink-0 rounded-lg border" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.productTemplate?.title ?? "商品信息暂不可用"}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.productTemplate?.description || "暂无商品规格"}</p>
                {item.nonPurchaseReason ? <p className="mt-2 text-sm text-destructive">未购买：{item.nonPurchaseReason}</p> : null}
              </div>
              <dl className="grid shrink-0 grid-cols-3 gap-5 text-center text-sm">
                <QuantityMetric label="需求" value={item.requiredQuantity} />
                <QuantityMetric label="采购" value={item.purchasedQuantity} />
                <QuantityMetric label="分发" value={item.distributedQuantity} />
              </dl>
              <div className="w-28 shrink-0 text-right">
                <p className="font-semibold">{item.purchasedQuantity === null ? "待结算" : formatPrice(item.subtotalCents)}</p>
                <p className="mt-1 text-xs text-muted-foreground">跑腿费 {formatPrice(item.serviceFeePerUnitCents)} / 件</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function QuantityMetric({ label, value }: { label: string; value: number | null }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value === null ? "待处理" : `${value} 件`}</dd></div>
}

function OrderInfoCard({ order }: { order: BuyerErrandOrderDetail }) {
  return <Card><CardHeader><CardTitle>订单信息</CardTitle><CardDescription>订单 #{order.id}</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt className="text-muted-foreground">店铺</dt><dd className="truncate text-right">{order.store?.name ?? "—"}</dd><dt className="text-muted-foreground">创建时间</dt><dd className="text-right">{formatDateTime(order.createdAt)}</dd><dt className="text-muted-foreground">期望送达</dt><dd className="text-right">{formatDateTime(order.deadline)}</dd></dl></CardContent></Card>
}

function AmountSummaryCard({ order }: { order: BuyerErrandOrderDetail }) {
  const productAmount = order.totalActualAmountCents ?? order.totalOriginAmountCents
  const adjustment = getBuyerErrandOrderAdjustmentCents(order)
  return <Card><CardHeader><CardTitle>金额汇总</CardTitle><CardDescription>待支付时以账单金额为准</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm"><dt className="text-muted-foreground">商品金额</dt><dd>{formatPrice(productAmount)}</dd><dt className="text-muted-foreground">跑腿费</dt><dd>{formatPrice(order.totalServiceFeeCents)}</dd>{adjustment !== 0 ? <><dt className="text-muted-foreground">包装费及调整</dt><dd>{adjustment < 0 ? `-${formatPrice(Math.abs(adjustment))}` : formatPrice(adjustment)}</dd></> : null}<dt className="border-t pt-3 font-medium">合计</dt><dd className="border-t pt-3 text-lg font-semibold text-primary">{formatPrice(getBuyerErrandOrderAmountCents(order))}</dd></dl></CardContent></Card>
}

function BillCard({ bill }: { bill: PaymentBill }) {
  return <Card><CardHeader><CardTitle>支付账单</CardTitle><CardDescription>{bill.billNo || `账单 #${bill.id}`}</CardDescription></CardHeader><CardContent className="grid gap-3"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">账单状态</span><Badge variant={bill.status === "completed" ? "success" : bill.status === "submitted" ? "attention" : bill.status === "unpaid" ? "payment" : "neutral"}>{getBillStatusLabel(bill.status)}</Badge></div><Separator /><dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt className="text-muted-foreground">收款人</dt><dd className="truncate text-right">{bill.payee?.name || "信息缺失"}</dd><dt className="text-muted-foreground">核验码</dt><dd className="break-all text-right font-mono font-semibold">{bill.verifyCode || "未生成"}</dd><dt className="text-muted-foreground">账单金额</dt><dd className="text-right font-semibold">{formatPrice(bill.amountCents)}</dd>{bill.serialNumber ? <><dt className="text-muted-foreground">流水号</dt><dd className="break-all text-right font-mono">{bill.serialNumber}</dd></> : null}</dl></CardContent></Card>
}

function PaymentDialog({ open, onOpenChange, bill, dataSource, connectBaseUrl, onPaid }: { open: boolean; onOpenChange: (open: boolean) => void; bill: PaymentBill; dataSource: DataSource; connectBaseUrl?: string; onPaid: (bill: PaymentBill) => void }) {
  const [channel, setChannel] = useState<PaymentQrChannel>("wechat")
  const [codes, setCodes] = useState<Partial<Record<PaymentQrChannel, string>>>({})
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const loadedFor = useRef<string | null>(null)
  const payingRef = useRef(false)

  useEffect(() => {
    const payeeId = bill.payee?.id
    if (!open || !payeeId || loadedFor.current === payeeId) return
    let cancelled = false
    setLoading(true)
    void listPaymentQrCodes({ dataSource, connectBaseUrl, ownerId: payeeId }).then((result) => {
      if (cancelled) return
      const mapped = Object.fromEntries(result.map((item) => [item.channel, item.content])) as Partial<Record<PaymentQrChannel, string>>
      setCodes(mapped)
      setChannel(mapped.wechat ? "wechat" : "alipay")
      loadedFor.current = payeeId
    }).catch(() => { if (!cancelled) toast.error("收款码加载失败") }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bill.payee?.id, connectBaseUrl, dataSource, open])

  async function submit() {
    if (!bill.updatedAt || !codes[channel] || payingRef.current) return
    payingRef.current = true
    setPaying(true)
    try {
      const updated = await payBill({ billId: bill.id, channel, updatedAt: bill.updatedAt }, { dataSource, connectBaseUrl })
      onPaid(updated)
      onOpenChange(false)
      toast.success("已提交支付，等待团长确认")
    } catch { toast.error("支付提交失败，请刷新账单后重试") }
    finally { payingRef.current = false; setPaying(false) }
  }

  const content = codes[channel]
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>扫码支付 {formatPrice(bill.amountCents)}</DialogTitle><DialogDescription>请核对收款人和核验码，扫码完成后再提交支付状态。</DialogDescription></DialogHeader><Tabs value={channel} onValueChange={(value) => setChannel(value as PaymentQrChannel)}><TabsList className="w-full"><TabsTrigger value="wechat" disabled={!codes.wechat}>微信</TabsTrigger><TabsTrigger value="alipay" disabled={!codes.alipay}>支付宝</TabsTrigger></TabsList></Tabs><div className="flex min-h-64 items-center justify-center rounded-xl bg-white p-5">{loading ? <Spinner className="text-primary" /> : content ? <QRCodeCanvas value={content} size={220} level="M" /> : <p className="text-sm text-muted-foreground">暂无可用收款码</p>}</div><div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm"><span className="text-muted-foreground">核验码</span><span className="font-mono text-lg font-semibold tracking-widest">{bill.verifyCode || "—"}</span></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>稍后支付</Button><Button onClick={submit} disabled={paying || !content || !bill.updatedAt}>{paying ? <Spinner /> : null}我已支付</Button></DialogFooter></DialogContent></Dialog>
}

function SupplementDialog({ open, onOpenChange, bill, dataSource, connectBaseUrl, onUpdated }: { open: boolean; onOpenChange: (open: boolean) => void; bill: PaymentBill; dataSource: DataSource; connectBaseUrl?: string; onUpdated: (bill: PaymentBill) => void }) {
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  async function submit() {
    if (!bill.updatedAt || !value.trim() || pending) return
    setPending(true)
    try {
      const updated = await supplementBillSerialNumber({ billId: bill.id, serialNumber: value.trim(), updatedAt: bill.updatedAt }, { dataSource, connectBaseUrl })
      onUpdated(updated)
      onOpenChange(false)
      toast.success("支付流水号已补充")
    } catch { toast.error("提交失败，请刷新账单状态后重试") }
    finally { setPending(false) }
  }
  return <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}><DialogContent><DialogHeader><DialogTitle>补充支付流水号</DialogTitle><DialogDescription>仅在已经支付但缺少流水号时填写。</DialogDescription></DialogHeader><Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="请输入支付流水号" /><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>取消</Button><Button onClick={submit} disabled={pending || !value.trim()}>{pending ? <Spinner /> : null}提交</Button></DialogFooter></DialogContent></Dialog>
}

function getBillStatusLabel(status: PaymentBill["status"]): string {
  if (status === "unpaid") return "待支付"
  if (status === "submitted") return "待确认收款"
  if (status === "completed") return "已完成"
  if (status === "closed") return "已关闭"
  return "状态未知"
}

function formatDateTime(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(date)
}
