"use client"

import { FormField } from "@/components/forms/form-field"
import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { ImageUpload } from "@/components/image-upload"
import { MobileHeader } from "@/components/layout/mobile-header"
import { OrderProgress } from "@/components/order-progress"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonDetail } from "@/components/states/skeleton-detail"
import { OrderStatusBadge, ShippingStatusBadge } from "@/components/status-badge"
import { isApiError } from "@/lib/api/errors"
import {
  useCompleteOrder,
  useConfirmPayment,
  useConfirmReceipt,
  useConfirmShippingFee,
  useOrder,
  useSetShippingFee,
  useShipOrder,
} from "@/lib/api/queries"
import type { Order } from "@/lib/api/types"
import { confirmReceiptSchema, setShippingFeeSchema, shipOrderSchema } from "@/lib/schemas/order"
import { useAuthStore } from "@/lib/stores/auth-store"
import { formatDateTime, formatPrice, sumPrice } from "@/lib/utils/format"
import { getOrderLabel, getOrderViewKey } from "@/lib/utils/order-state"
import { notify } from "@/lib/utils/toast"
import { Alert, Button, Input, InputGroup, InputOTP, Label, TextArea } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useParams, useRouter } from "next/navigation"
import { useId, useState } from "react"

const COMMON_CARRIERS = [
  "顺丰速运",
  "中通快递",
  "圆通速递",
  "韵达速递",
  "京东物流",
  "邮政 EMS",
  "校内自取",
]

export default function OrderDetailView() {
  const params = useParams<{ id: string }>()
  const orderId = params.id
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId)

  if (isPending) {
    return (
      <>
        <MobileHeader showBack title="订单详情" />
        <SkeletonDetail />
      </>
    )
  }
  if (isError || !order) {
    return (
      <>
        <MobileHeader showBack title="订单详情" />
        <div className="mx-auto w-full max-w-3xl px-4 pt-6">
          <ErrorState error={error} onRetry={() => refetch()} title="订单不存在或已被关闭" />
        </div>
      </>
    )
  }

  return (
    <>
      <MobileHeader showBack title="订单详情" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-24 md:gap-4 md:px-8 md:py-8">
        <StatusBanner order={order} />
        <OrderProgress order={order} />
        <RefundBanner order={order} />
        <ListingPanel order={order} />
        <ActionRouter order={order} />
        <PaymentPanel order={order} />
        <FeesPanel order={order} />
        <ShippingPanel order={order} />
        <Timeline order={order} />
      </div>
    </>
  )
}

const alertStatusMap = {
  warning: "warning",
  primary: "accent",
  success: "success",
  danger: "danger",
  default: "default",
} as const

function StatusBanner({ order }: { order: Order }) {
  const label = getOrderLabel(order)
  return (
    <Alert status={alertStatusMap[label.badge]}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{label.text}</Alert.Title>
        {label.hint ? <Alert.Description>{label.hint}</Alert.Description> : null}
      </Alert.Content>
    </Alert>
  )
}

function RefundBanner({ order }: { order: Order }) {
  if (order.status !== "refunding" && order.status !== "refunded" && order.status !== "closed") {
    return null
  }
  const labelMap = {
    refunding: {
      title: "退款进行中",
      desc: "管理员或卖家正在处理你的退款，到账时间通常 3 个工作日内。",
    },
    refunded: { title: "退款已完成", desc: "退款已发放至原支付账户，请留意账单。" },
    closed: { title: "订单已关闭", desc: "订单因超时或人工关闭而结束。如有疑问可联系管理员。" },
  } as const
  const info = labelMap[order.status as keyof typeof labelMap]
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{info.title}</Alert.Title>
        <Alert.Description>{info.desc}</Alert.Description>
      </Alert.Content>
      <Button
        onPress={() => notify({ title: "请通过飞书联系 SAST Shop 管理员", color: "default" })}
        size="sm"
        variant="outline"
      >
        联系管理员
      </Button>
    </Alert>
  )
}

function ListingPanel({ order }: { order: Order }) {
  return (
    <section className="shop-section flex !flex-row gap-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-shop-sm bg-shop-bg-tinted">
        {order.listing.image_url ? (
          <img alt="" className="size-full object-cover" src={order.listing.image_url} />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-[14px] font-medium text-shop-text-primary">
          {order.listing.title}
        </span>
        <span className="text-[12px] text-shop-text-tertiary">数量 ×{order.quantity}</span>
        <span className="text-[18px] font-bold tabular-nums text-shop-primary">
          <span className="text-[12px]">¥</span>
          {Number(order.amount).toFixed(2)}
        </span>
      </div>
    </section>
  )
}

function PaymentPanel({ order }: { order: Order }) {
  const showCode = order.payment_code !== null
  return (
    <section className="shop-section">
      <h2 className="shop-section__title">支付信息</h2>
      <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
        {showCode ? (
          <>
            <dt className="text-shop-text-tertiary">付款备注码</dt>
            <dd className="font-mono text-[18px] font-semibold tracking-widest text-shop-primary">
              {order.payment_code}
            </dd>
          </>
        ) : null}
        {order.payment_method ? (
          <>
            <dt className="text-shop-text-tertiary">支付方式</dt>
            <dd className="text-shop-text-primary">
              {order.payment_method === "wechat" ? "微信" : "支付宝"}
            </dd>
          </>
        ) : null}
        {order.payment_trade_no ? (
          <>
            <dt className="text-shop-text-tertiary">交易流水号</dt>
            <dd className="break-all text-shop-text-primary">{order.payment_trade_no}</dd>
          </>
        ) : null}
      </dl>
      {order.payment_qr_url ? (
        <figure className="mt-2 flex flex-col items-center gap-2 rounded-shop-sm bg-shop-bg-tinted p-3">
          <div className="size-40 overflow-hidden rounded-shop-sm bg-shop-bg-white">
            <img alt="付款二维码" className="size-full object-cover" src={order.payment_qr_url} />
          </div>
          <figcaption className="text-[12px] text-shop-text-tertiary">
            扫码支付，备注请填入：
            <span className="ml-1 font-mono font-semibold text-shop-primary">
              {order.payment_code}
            </span>
          </figcaption>
        </figure>
      ) : null}
    </section>
  )
}

function FeesPanel({ order }: { order: Order }) {
  const total = sumPrice(order.amount, order.shipping_fee ?? "0")
  return (
    <section className="shop-section text-[13px]">
      <h2 className="shop-section__title">费用明细</h2>
      <Row label="商品金额" value={formatPrice(order.amount)} />
      <Row label="运费" value={order.shipping_fee ? formatPrice(order.shipping_fee) : "—"} />
      <div className="mt-1 flex items-baseline justify-between border-t border-shop-border-light pt-2 text-[15px] font-semibold">
        <span>合计</span>
        <span className="text-[20px] tabular-nums text-shop-primary">
          <span className="text-[14px]">¥</span>
          {Number(total).toFixed(2)}
        </span>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-shop-text-secondary">{label}</span>
      <span className="text-shop-text-primary tabular-nums">{value}</span>
    </div>
  )
}

function ShippingPanel({ order }: { order: Order }) {
  if (!order.shipping_address && !order.tracking_number) return null
  return (
    <section className="shop-section text-[13px]">
      <h2 className="shop-section__title">物流信息</h2>
      {order.shipping_address ? (
        <div className="rounded-shop-sm bg-shop-bg-tinted p-3 text-shop-text-secondary whitespace-pre-line">
          {order.shipping_address}
        </div>
      ) : null}
      {order.tracking_number ? (
        <p className="text-shop-text-secondary">
          {order.carrier ? `${order.carrier} · ` : ""}运单号：
          <span className="font-mono text-shop-text-primary">{order.tracking_number}</span>
        </p>
      ) : null}
      {order.shipping_status ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-shop-text-tertiary">运费状态</span>
          <ShippingStatusBadge status={order.shipping_status} />
        </div>
      ) : null}
    </section>
  )
}

function Timeline({ order }: { order: Order }) {
  if (!order.timeline?.length) return null
  return (
    <section className="shop-section text-[13px]">
      <h2 className="shop-section__title">订单时间线</h2>
      <ol className="flex flex-col gap-2">
        {order.timeline.map((entry, i) => (
          <li className="flex items-baseline gap-3" key={`${entry.status}-${i}`}>
            <span className="font-mono text-[11px] text-shop-text-tertiary tabular-nums">
              {formatDateTime(entry.at)}
            </span>
            <OrderStatusBadge status={entry.status as Order["status"]} />
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---- Action router ---------------------------------------------------------

function ActionRouter({ order }: { order: Order }) {
  const me = useAuthStore((s) => s.user)
  const isBuyer = me?.id === order.buyer.id
  const isSeller = me?.id === order.seller.id
  const view = getOrderViewKey(order)

  if (!me) return null

  if (isBuyer && view === "pending_payment") return <BuyerPay order={order} />
  if (isBuyer && view === "shipped") return <BuyerComplete order={order} />
  if (isBuyer && view === "shipping_fee_paying") return <BuyerPayShipping order={order} />
  if (isSeller && view === "pending_confirm") return <SellerConfirmPayment order={order} />
  if (isSeller && view === "shipping_fee_pending") return <SellerSetShippingFee order={order} />
  if (
    isSeller &&
    (view === "paid" || view === "producing") &&
    order.tracking_number === null &&
    !(order.listing.shipping_mode === "variable" && order.shipping_status !== "paid")
  ) {
    return <SellerShip order={order} />
  }
  return null
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-shop-lg border border-shop-primary-soft bg-shop-primary-wash p-4">
      <h2 className="text-[15px] font-semibold text-shop-primary">{title}</h2>
      {children}
    </section>
  )
}

// --- Buyer panels -----------------------------------------------------------

function BuyerPay({ order }: { order: Order }) {
  const confirm = useConfirmReceipt(order.id)
  const form = useTypedForm(confirmReceiptSchema, {
    defaultValues: { payment_code: "", payment_trade_no: "" },
  })
  async function onSubmit(values: { payment_code?: string; payment_trade_no?: string }) {
    try {
      await confirm.mutateAsync({
        payment_code: values.payment_code || undefined,
        payment_trade_no: values.payment_trade_no || undefined,
      })
      notify({ title: "已通知卖家确认", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "提交失败", color: "danger" })
    }
  }
  return (
    <ActionCard title="完成支付后点这里">
      <p className="text-[12px] text-shop-text-secondary">
        请使用展示的二维码完成支付，并在备注中填入 4 位备注码。完成后通知卖家。
      </p>
      <FormProvider {...form}>
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="4 位备注码" name="payment_code">
            {({ value, onChange }) => (
              <InputOTP
                maxLength={4}
                onChange={(v) => onChange(v)}
                value={(value as string) ?? ""}
                variant="secondary"
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                  <InputOTP.Slot index={3} />
                </InputOTP.Group>
              </InputOTP>
            )}
          </FormField>
          <FormField
            hint="若未填备注码，请提供平台流水号"
            label="交易流水号（可选）"
            name="payment_trade_no"
          >
            <Input placeholder="平台流水号" variant="secondary" />
          </FormField>
          <Button isPending={confirm.isPending} type="submit" variant="primary">
            通知卖家
          </Button>
        </form>
      </FormProvider>
    </ActionCard>
  )
}

function BuyerComplete({ order }: { order: Order }) {
  const complete = useCompleteOrder(order.id)
  async function submit() {
    try {
      await complete.mutateAsync()
      notify({ title: "已确认收货", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
    }
  }
  return (
    <ActionCard title="收到货了">
      <p className="text-[12px] text-shop-text-secondary">确认收货前请验货完毕，确认后无法撤销。</p>
      <Button isPending={complete.isPending} onPress={submit} variant="primary">
        确认收货
      </Button>
    </ActionCard>
  )
}

function BuyerPayShipping({ order }: { order: Order }) {
  const confirm = useConfirmShippingFee(order.id)
  const form = useTypedForm(confirmReceiptSchema, {
    defaultValues: { payment_code: "", payment_trade_no: "" },
  })
  async function onSubmit(values: { payment_code?: string; payment_trade_no?: string }) {
    try {
      await confirm.mutateAsync({
        payment_code: values.payment_code || undefined,
        payment_trade_no: values.payment_trade_no || undefined,
      })
      notify({ title: "已提交运费支付", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "提交失败", color: "danger" })
    }
  }
  return (
    <ActionCard title="支付运费">
      <p className="text-[12px] text-shop-text-secondary">
        卖家已确认实际运费 {formatPrice(order.shipping_fee)}，请使用对应二维码支付并提交。
      </p>
      <FormProvider {...form}>
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="4 位备注码" name="payment_code">
            {({ value, onChange }) => (
              <InputOTP
                maxLength={4}
                onChange={(v) => onChange(v)}
                value={(value as string) ?? ""}
                variant="secondary"
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                  <InputOTP.Slot index={3} />
                </InputOTP.Group>
              </InputOTP>
            )}
          </FormField>
          <FormField label="交易流水号（可选）" name="payment_trade_no">
            <Input placeholder="若未填备注码，请提供" variant="secondary" />
          </FormField>
          <Button isPending={confirm.isPending} type="submit" variant="primary">
            提交支付凭证
          </Button>
        </form>
      </FormProvider>
    </ActionCard>
  )
}

// --- Seller panels ----------------------------------------------------------

function SellerConfirmPayment({ order }: { order: Order }) {
  const router = useRouter()
  const confirm = useConfirmPayment(order.id)
  const isVariable = order.listing.shipping_mode === "variable"
  const [shippingFee, setShippingFee] = useState("")

  async function submit() {
    try {
      await confirm.mutateAsync(
        isVariable && shippingFee ? { shipping_fee_confirmed: shippingFee } : {}
      )
      notify({ title: "已确认收款", color: "success" })
      router.refresh()
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
    }
  }

  return (
    <ActionCard title="确认收款">
      <p className="text-[12px] text-shop-text-secondary">
        请核对买家提交的备注码（{order.payment_code ?? "—"}）是否与你的收款记录匹配。
      </p>
      {isVariable ? (
        <div className="flex flex-col gap-1.5">
          <Label
            className="text-[13px] font-medium text-shop-text-secondary"
            htmlFor="shipping-fee"
          >
            实际运费 (可选)
          </Label>
          <InputGroup fullWidth variant="secondary">
            <InputGroup.Prefix>¥</InputGroup.Prefix>
            <InputGroup.Input
              id="shipping-fee"
              inputMode="decimal"
              onChange={(e) => setShippingFee(e.target.value)}
              placeholder="留空则进入二次确认流程"
              value={shippingFee}
            />
          </InputGroup>
        </div>
      ) : null}
      <Button isPending={confirm.isPending} onPress={submit} variant="primary">
        我已收到付款
      </Button>
    </ActionCard>
  )
}

function SellerSetShippingFee({ order }: { order: Order }) {
  const setFee = useSetShippingFee(order.id)
  const form = useTypedForm(setShippingFeeSchema, {
    defaultValues: { shipping_fee: "", shipping_qr_url: "" },
  })

  async function onSubmit(values: { shipping_fee: string; shipping_qr_url: string }) {
    try {
      await setFee.mutateAsync(values)
      notify({ title: "已通知买家支付运费", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
    }
  }

  return (
    <ActionCard title="确认运费金额">
      <FormProvider {...form}>
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="实际运费 (元)" name="shipping_fee" required>
            {({ value, onChange, invalid, describedBy }) => (
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Prefix>¥</InputGroup.Prefix>
                <InputGroup.Input
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  inputMode="decimal"
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="12.50"
                  value={(value as string) ?? ""}
                />
              </InputGroup>
            )}
          </FormField>
          <FormField
            hint="支持运费金额的二维码图片"
            label="运费二维码"
            name="shipping_qr_url"
            required
          >
            {({ value, onChange }) => (
              <ImageUpload
                hint="买家扫码支付运费"
                max={1}
                onChange={(urls) => onChange(urls[0] ?? "")}
                purpose="shipping_qr"
                value={typeof value === "string" && value ? [value] : []}
              />
            )}
          </FormField>
          <Button isPending={setFee.isPending} type="submit" variant="primary">
            通知买家支付
          </Button>
        </form>
      </FormProvider>
    </ActionCard>
  )
}

function SellerShip({ order }: { order: Order }) {
  const ship = useShipOrder(order.id)
  const carrierListId = useId()
  const form = useTypedForm(shipOrderSchema, {
    defaultValues: { carrier: "", tracking_number: "" },
  })

  async function onSubmit(values: { carrier: string; tracking_number: string }) {
    try {
      await ship.mutateAsync(values)
      notify({ title: "已发货", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
    }
  }

  return (
    <ActionCard title="填写发货信息">
      <FormProvider {...form}>
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField label="承运商" name="carrier" required>
            <Input list={carrierListId} placeholder="例如 顺丰速运" variant="secondary" />
          </FormField>
          <datalist id={carrierListId}>
            {COMMON_CARRIERS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FormField label="运单号" name="tracking_number" required>
            <Input placeholder="例如 SF1234567890" variant="secondary" />
          </FormField>
          <FormField
            hint="给买家的备注（不会写入运单）"
            label="备注（可选）"
            maxLength={200}
            name="remark"
          >
            <TextArea placeholder="例如 包裹在 18:00 后揽收" rows={2} variant="secondary" />
          </FormField>
          <Button isPending={ship.isPending} type="submit" variant="primary">
            确认发货
          </Button>
        </form>
      </FormProvider>
      <p className="text-[11px] text-shop-text-tertiary">
        备注会通过站内消息通知买家（功能即将上线）。
      </p>
    </ActionCard>
  )
}
