"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiInformationLine,
  RiShoppingBag3Line,
  RiShoppingCartLine,
  RiSubtractLine,
} from "@remixicon/react"
import {
  createErrandDemand,
  type DataSource,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api"
import {
  formatPrice,
  getDefaultErrandDeadline,
  isValidErrandDeadline,
  toDateTimeLocalValue,
} from "@sast-shop/domain"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
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
import { Empty } from "@workspace/ui/components/empty"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { toast } from "sonner"

import { ManagedImage } from "@/components/managed-image"

type CartItem = {
  template: ProductTemplate
  quantity: number
  serviceFeePerUnitCents: number
}

const MAX_QUANTITY = 20
const moneyPattern = /^\d*(?:\.\d{0,2})?$/

export function ErrandShop({
  dataSource,
  connectBaseUrl,
  store,
  templates,
  error,
}: {
  dataSource: DataSource
  connectBaseUrl?: string
  store: Store | null
  templates: ProductTemplate[]
  error: string | null
}) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [items, setItems] = useState<CartItem[]>([])
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({})
  const [deadlineValue, setDeadlineValue] = useState(() =>
    toDateTimeLocalValue(getDefaultErrandDeadline()),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const cartById = useMemo(
    () => new Map(items.map((item) => [item.template.id, item])),
    [items],
  )
  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        serviceFeePerUnitCents: parseMoneyDraftToCents(
          feeDrafts[item.template.id] ?? formatYuanInput(item.serviceFeePerUnitCents),
        ),
      })),
    [feeDrafts, items],
  )
  const totalQuantity = normalizedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )
  const goodsAmount = normalizedItems.reduce(
    (total, item) => total + item.template.priceCents * item.quantity,
    0,
  )
  const serviceFee = normalizedItems.reduce(
    (total, item) => total + item.serviceFeePerUnitCents * item.quantity,
    0,
  )

  if (!store || error) {
    return (
      <Empty
        icon={<RiShoppingBag3Line className="size-5" />}
        title="店铺商品暂不可用"
        description={error ?? "没有找到对应店铺。"}
        action={
          <Button asChild variant="outline">
            <Link href="/group">返回团购工作台</Link>
          </Button>
        }
      />
    )
  }

  const storeId = store.id

  function updateQuantity(template: ProductTemplate, nextQuantity: number) {
    setItems((current) => {
      const exists = current.some((item) => item.template.id === template.id)
      if (!exists && nextQuantity > 0) {
        return [...current, { template, quantity: 1, serviceFeePerUnitCents: 0 }]
      }
      return current
        .map((item) =>
          item.template.id === template.id
            ? {
                ...item,
                quantity: Math.min(Math.max(nextQuantity, 0), MAX_QUANTITY),
              }
            : item,
        )
        .filter((item) => item.quantity > 0)
    })
    if (nextQuantity <= 0) {
      setFeeDrafts((current) => {
        const next = { ...current }
        delete next[template.id]
        return next
      })
    }
  }

  function updateFeeDraft(templateId: string, value: string) {
    if (!moneyPattern.test(value)) return
    setFeeDrafts((current) => ({ ...current, [templateId]: value }))
  }

  function openConfirmation() {
    if (items.length === 0) {
      toast.error("请先选择商品")
      return
    }
    const deadline = new Date(deadlineValue)
    if (Number.isNaN(deadline.getTime()) || !isValidErrandDeadline(deadline)) {
      toast.error("期望送达时间至少需要在 2 小时后")
      return
    }
    setConfirmOpen(true)
  }

  async function submitDemand() {
    if (submittingRef.current || normalizedItems.length === 0) return
    const deadline = new Date(deadlineValue)
    if (Number.isNaN(deadline.getTime()) || !isValidErrandDeadline(deadline)) {
      toast.error("期望送达时间至少需要在 2 小时后")
      setConfirmOpen(false)
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      await createErrandDemand(
        {
          storeId,
          deadline: deadline.toISOString(),
          items: normalizedItems.map((item) => ({
            productTemplateId: item.template.id,
            quantity: item.quantity,
            serviceFeePerUnitCents: item.serviceFeePerUnitCents,
            updatedAt: item.template.updatedAt,
          })),
        },
        { dataSource, connectBaseUrl },
      )
      toast.success("跑腿需求已发起")
      setConfirmOpen(false)
      router.push("/orders?type=errand&view=participant")
    } catch {
      toast.error("跑腿需求提交失败，请稍后再试")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <ManagedImage
            src={store.logoUrl}
            alt={store.name}
            className="size-16 shrink-0 rounded-xl border"
          />
          <div className="min-w-0">
            <Badge variant="muted">发起跑腿需求</Badge>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight">
              {store.name}
            </h1>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {store.address || "暂无店铺地址"}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/group">
            <RiArrowLeftLine data-icon="inline-start" />
            返回团购工作台
          </Link>
        </Button>
      </section>

      <Alert>
        <RiInformationLine />
        <AlertTitle>商品价格用于预估</AlertTitle>
        <AlertDescription>
          最终金额以团长实际采购结果为准；请为每件商品设置合适的跑腿费。
        </AlertDescription>
      </Alert>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">商品模板</h2>
            <span className="text-sm text-muted-foreground">
              {templates.length} 个可选
            </span>
          </div>
          {templates.length === 0 ? (
            <Empty
              icon={<RiShoppingBag3Line className="size-5" />}
              title="此店铺暂无商品模板"
              description="可以返回团购工作台选择其他店铺。"
            />
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {templates.map((template) => {
                const cartItem = cartById.get(template.id)
                return (
                  <Card key={template.id} className="min-w-0 overflow-hidden">
                    <CardContent className="flex min-w-0 gap-4 p-4">
                      <ManagedImage
                        src={template.mainImageUrl}
                        alt={template.title}
                        className="size-24 shrink-0 rounded-lg border"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="line-clamp-2 font-semibold">
                          {template.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {template.description || "暂无规格说明"}
                        </p>
                        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                          <span className="font-semibold text-primary">
                            {formatPrice(template.priceCents)}
                          </span>
                          {cartItem ? (
                            <QuantityControl
                              title={template.title}
                              quantity={cartItem.quantity}
                              onDecrement={() =>
                                updateQuantity(template, cartItem.quantity - 1)
                              }
                              onIncrement={() =>
                                updateQuantity(template, cartItem.quantity + 1)
                              }
                            />
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => updateQuantity(template, 1)}
                            >
                              <RiAddLine data-icon="inline-start" />
                              加入清单
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        <aside className="min-w-0">
          <Card className="sticky top-24 max-h-[calc(100dvh-7rem)] min-w-0 overflow-hidden">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RiShoppingCartLine className="size-5" />
                    跑腿清单
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {totalQuantity > 0 ? `${totalQuantity} 件商品` : "尚未选择商品"}
                  </CardDescription>
                </div>
                {items.length > 0 ? (
                  <Badge variant="secondary">{items.length} 种</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="app-scrollbar max-h-[calc(100dvh-18rem)] space-y-4 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  从左侧选择需要代购的商品。
                </p>
              ) : (
                <div className="grid gap-4">
                  {items.map((item) => (
                    <div key={item.template.id} className="grid gap-3 rounded-lg border p-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.template.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatPrice(item.template.priceCents)} / 件
                          </p>
                        </div>
                        <QuantityControl
                          title={item.template.title}
                          quantity={item.quantity}
                          onDecrement={() =>
                            updateQuantity(item.template, item.quantity - 1)
                          }
                          onIncrement={() =>
                            updateQuantity(item.template, item.quantity + 1)
                          }
                        />
                      </div>
                      <Field>
                        <FieldLabel htmlFor={`fee-${item.template.id}`}>
                          单件跑腿费
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <InputGroupText>¥</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            id={`fee-${item.template.id}`}
                            inputMode="decimal"
                            value={
                              feeDrafts[item.template.id] ??
                              formatYuanInput(item.serviceFeePerUnitCents)
                            }
                            onChange={(event) =>
                              updateFeeDraft(item.template.id, event.target.value)
                            }
                          />
                        </InputGroup>
                      </Field>
                    </div>
                  ))}
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="errand-deadline">期望送达时间</FieldLabel>
                <Input
                  id="errand-deadline"
                  type="datetime-local"
                  value={deadlineValue}
                  onChange={(event) => setDeadlineValue(event.target.value)}
                />
              </Field>

              <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <TotalRow label="商品标价" value={goodsAmount} />
                <TotalRow label="跑腿费" value={serviceFee} />
                <TotalRow label="预估合计" value={goodsAmount + serviceFee} strong />
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={items.length === 0 || submitting}
                onClick={openConfirmation}
              >
                确认发起需求
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认发起跑腿需求？</DialogTitle>
            <DialogDescription>
              共 {items.length} 种、{totalQuantity} 件商品。提交后会出现在跑腿大厅，
              团长接单前仍按商品模板价格预估。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <TotalRow label="商品标价" value={goodsAmount} />
            <TotalRow label="跑腿费" value={serviceFee} />
            <TotalRow label="预估合计" value={goodsAmount + serviceFee} strong />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              返回修改
            </Button>
            <Button type="button" disabled={submitting} onClick={submitDemand}>
              {submitting ? "正在提交…" : "确认提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuantityControl({
  title,
  quantity,
  onDecrement,
  onIncrement,
}: {
  title: string
  quantity: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`减少${title}数量`}
        onClick={onDecrement}
      >
        <RiSubtractLine />
      </Button>
      <span className="min-w-7 text-center text-sm font-semibold">{quantity}</span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`增加${title}数量`}
        disabled={quantity >= MAX_QUANTITY}
        onClick={onIncrement}
      >
        <RiAddLine />
      </Button>
    </div>
  )
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-primary" : "font-medium"}>
        {formatPrice(value)}
      </span>
    </div>
  )
}

function formatYuanInput(cents: number): string {
  return cents === 0 ? "0" : (cents / 100).toFixed(2)
}

function parseMoneyDraftToCents(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0
}
