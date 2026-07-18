"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RiArrowLeftLine, RiCheckboxCircleLine } from "@remixicon/react"
import {
  confirmBill,
  transitionToCompleted,
  type CollectingPaymentBill,
  type CollectingPaymentDetail,
  type DataSource,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
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
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "sonner"

export function CollectingPaymentView({
  dataSource,
  connectBaseUrl,
  detail,
  taskId,
}: {
  dataSource: DataSource
  connectBaseUrl?: string
  detail: CollectingPaymentDetail
  taskId: string
}) {
  const router = useRouter()
  const confirmingRef = useRef(false)
  const completingRef = useRef(false)
  const [bills, setBills] = useState(detail.bills)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [billToConfirm, setBillToConfirm] = useState<CollectingPaymentBill | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const confirmedCount = bills.filter((bill) => bill.paymentStatus === "confirmed").length
  const allConfirmed = bills.length > 0 && confirmedCount === bills.length
  const totalAmount = bills.reduce((total, bill) => total + bill.totalAmountCents, 0)
  const serviceOptions = { dataSource, connectBaseUrl }

  async function confirmPayment(bill: CollectingPaymentBill) {
    if (!bill.billId || !bill.billUpdatedAt || confirmingRef.current) {
      if (!bill.billId || !bill.billUpdatedAt) toast.error("账单版本信息缺失，请刷新任务")
      return
    }
    confirmingRef.current = true
    setConfirmingId(bill.requesterId)
    try {
      await confirmBill(
        { billId: bill.billId, updatedAt: bill.billUpdatedAt },
        serviceOptions,
      )
      setBills((current) => current.map((candidate) => candidate.requesterId === bill.requesterId ? { ...candidate, paymentStatus: "confirmed" } : candidate))
      setBillToConfirm(null)
      toast.success("已确认到账")
    } catch { toast.error("确认收款失败，请刷新账单后重试") }
    finally { confirmingRef.current = false; setConfirmingId(null) }
  }

  async function completeTask() {
    if (!allConfirmed || completingRef.current) return
    completingRef.current = true
    setCompleting(true)
    try {
      await transitionToCompleted(taskId, null, serviceOptions)
      toast.success("跑腿任务已完成")
      setCompleteOpen(false)
      router.push("/orders?type=errand&view=captain")
    } catch { toast.error("完成任务失败，请刷新账单后重试") }
    finally { completingRef.current = false; setCompleting(false) }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-2"><Link href="/orders?type=errand&view=captain"><RiArrowLeftLine data-icon="inline-start" />返回任务列表</Link></Button>
          <div className="flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">收款与完成</h1><Badge variant="attention">收款中</Badge></div>
          <p className="mt-2 text-sm text-muted-foreground">逐笔核对参与者付款，全部确认后完成跑腿任务。</p>
        </div>
        <Button disabled={!allConfirmed} onClick={() => setCompleteOpen(true)}><RiCheckboxCircleLine data-icon="inline-start" />完成跑腿任务</Button>
      </section>

      <Card><CardContent className="grid grid-cols-3 gap-6 p-5"><Metric label="参与者账单" value={`${bills.length} 笔`} /><Metric label="已确认收款" value={`${confirmedCount} / ${bills.length}`} /><Metric label="账单总额" value={formatPrice(totalAmount)} emphasized /></CardContent></Card>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        {bills.map((bill) => (
          <BillCard key={bill.billId ?? bill.requesterId} bill={bill} confirming={confirmingId === bill.requesterId} onConfirm={() => setBillToConfirm(bill)} />
        ))}
      </section>

      <Dialog open={completeOpen} onOpenChange={(open) => !completing && setCompleteOpen(open)}><DialogContent><DialogHeader><DialogTitle>确认完成跑腿任务？</DialogTitle><DialogDescription>所有 {bills.length} 笔账单均已确认到账。提交后任务进入完成状态。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={completing} onClick={() => setCompleteOpen(false)}>返回检查</Button><Button disabled={completing || !allConfirmed} onClick={completeTask}>{completing ? <Spinner /> : null}确认完成</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={billToConfirm !== null} onOpenChange={(open) => !open && !confirmingRef.current && setBillToConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认这笔款项已到账？</DialogTitle>
            <DialogDescription>这是不可逆的财务确认，请与实际收款记录逐项核对。</DialogDescription>
          </DialogHeader>
          {billToConfirm ? (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
              <dt className="text-muted-foreground">付款人</dt><dd className="truncate text-right font-medium">{billToConfirm.requesterName}</dd>
              <dt className="text-muted-foreground">金额</dt><dd className="text-right font-semibold text-primary">{formatPrice(billToConfirm.totalAmountCents)}</dd>
              <dt className="text-muted-foreground">账单号</dt><dd className="truncate text-right font-mono text-xs">{billToConfirm.billNo ?? "未提供"}</dd>
              <dt className="text-muted-foreground">支付渠道</dt><dd className="text-right">{formatPaymentChannel(billToConfirm.paymentChannel)}</dd>
              <dt className="text-muted-foreground">支付流水号</dt><dd className="break-all text-right">{billToConfirm.serialNumber ?? "未填写"}</dd>
              <dt className="text-muted-foreground">核验码</dt><dd className="text-right font-mono font-semibold tracking-widest">{billToConfirm.verifyCode ?? "未提供"}</dd>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={confirmingId !== null} onClick={() => setBillToConfirm(null)}>返回检查</Button>
            <Button disabled={!billToConfirm || confirmingId !== null} onClick={() => billToConfirm && void confirmPayment(billToConfirm)}>{confirmingId !== null ? <Spinner /> : null}确认已到账</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatPaymentChannel(channel: CollectingPaymentBill["paymentChannel"]): string {
  if (channel === "wechat") return "微信支付"
  if (channel === "alipay") return "支付宝"
  return "未选择"
}

function BillCard({ bill, confirming, onConfirm }: { bill: CollectingPaymentBill; confirming: boolean; onConfirm: () => void }) {
  return <Card className="min-w-0 overflow-hidden"><CardHeader className="flex-row items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Avatar className="size-10"><AvatarImage src={bill.requesterAvatarUrl} alt={bill.requesterName} /><AvatarFallback>{bill.requesterName.trim().slice(0, 1) || "用"}</AvatarFallback></Avatar><div className="min-w-0"><CardTitle className="truncate text-base">{bill.requesterName}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">{bill.billNo || `账单 ${bill.billId ?? "未生成"}`}</p></div></div><div className="shrink-0 text-right"><PaymentStatusBadge status={bill.paymentStatus} /><p className="mt-2 text-lg font-semibold text-primary">{formatPrice(bill.totalAmountCents)}</p></div></CardHeader><CardContent className="grid gap-3 border-t pt-4"><div className="grid gap-2">{bill.items.map((item) => <div key={item.errandDemandItemId} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-muted-foreground">{item.title} × {item.distributedQuantity}</span><span className="shrink-0 font-medium">{formatPrice(item.subtotalCents)}</span></div>)}</div><Separator /><dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm"><dt className="text-muted-foreground">商品费</dt><dd>{formatPrice(bill.productAmountCents)}</dd><dt className="text-muted-foreground">跑腿费</dt><dd>{formatPrice(bill.serviceFeeAmountCents)}</dd><dt className="text-muted-foreground">包装费</dt><dd>{formatPrice(bill.packagingFeeShareCents)}</dd></dl>{bill.paymentStatus === "pending_confirmation" ? <Button className="mt-1" disabled={confirming || !bill.billId || !bill.billUpdatedAt} onClick={onConfirm}>{confirming ? <Spinner /> : null}确认已到账</Button> : null}</CardContent></Card>
}

function PaymentStatusBadge({ status }: { status: CollectingPaymentBill["paymentStatus"] }) {
  if (status === "pending_confirmation") return <Badge variant="attention">待确认</Badge>
  if (status === "pending") return <Badge variant="payment">未支付</Badge>
  if (status === "confirmed") return <Badge variant="success">已收款</Badge>
  if (status === "problem") return <Badge variant="danger">问题账单</Badge>
  return <Badge variant="neutral">状态未知</Badge>
}

function Metric({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div><p className="text-sm text-muted-foreground">{label}</p><p className={emphasized ? "mt-1 text-xl font-semibold text-primary" : "mt-1 text-xl font-semibold"}>{value}</p></div>
}
