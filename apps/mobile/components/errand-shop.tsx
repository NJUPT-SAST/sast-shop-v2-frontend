"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RiAddLine,
  RiInformationLine,
  RiShoppingBag3Line,
  RiShoppingCartLine,
  RiStore2Line,
  RiSubtractLine,
} from "@remixicon/react"
import {
  createErrandDemand,
  type DataSource,
  type ProductTemplate,
  type ServiceOptions,
  type Store,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { toast } from "sonner"

import {
  getDefaultErrandDeadline,
  isValidErrandDeadline,
  toDateTimeLocalValue,
} from "@/lib/errand-delivery-time"
import { ManagedImage } from "./managed-image"

type ErrandShopProps = {
  dataSource: DataSource
  connectBaseUrl: string
  store: Store
  templates: ProductTemplate[]
}

type ErrandCartItem = {
  template: ProductTemplate
  quantity: number
  serviceFeePerUnitCents: number
}

const MAX_QUANTITY = 20
const MONEY_DRAFT_PATTERN = /^\d*(?:\.\d{0,2})?$/
const TEMPLATE_REFRESH_INTERVAL_MS = 15_000

export function ErrandShop({
  dataSource,
  connectBaseUrl,
  store,
  templates,
}: ErrandShopProps) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [items, setItems] = useState<ErrandCartItem[]>([])
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProductTemplate | null>(null)
  const [deadlineValue, setDeadlineValue] = useState(() =>
    toDateTimeLocalValue(getDefaultErrandDeadline())
  )
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (cartOpen || selectedTemplate || submitting) {
      return
    }

    const refreshTemplates = () => {
      if (document.visibilityState === "visible") {
        router.refresh()
      }
    }
    const refreshInterval = window.setInterval(
      refreshTemplates,
      TEMPLATE_REFRESH_INTERVAL_MS
    )

    document.addEventListener("visibilitychange", refreshTemplates)

    return () => {
      window.clearInterval(refreshInterval)
      document.removeEventListener("visibilitychange", refreshTemplates)
    }
  }, [cartOpen, router, selectedTemplate, submitting])

  const cartByTemplateId = useMemo(
    () => new Map(items.map((item) => [item.template.id, item])),
    [items]
  )
  const pricedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        serviceFeePerUnitCents: parseMoneyDraftToCents(
          feeDrafts[item.template.id] ??
            formatYuanInput(item.serviceFeePerUnitCents)
        ),
      })),
    [feeDrafts, items]
  )
  const totalCount = pricedItems.reduce((total, item) => total + item.quantity, 0)
  const totalOriginAmountCents = pricedItems.reduce(
    (total, item) => total + item.template.priceCents * item.quantity,
    0
  )
  const totalServiceFeeCents = pricedItems.reduce(
    (total, item) => total + item.serviceFeePerUnitCents * item.quantity,
    0
  )
  const estimatedTotalCents = totalOriginAmountCents + totalServiceFeeCents

  const addItem = (template: ProductTemplate) => {
    setFeeDrafts((currentDrafts) =>
      template.id in currentDrafts
        ? currentDrafts
        : { ...currentDrafts, [template.id]: "" }
    )
    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.template.id === template.id
      )

      if (existingItem) {
        return currentItems.map((item) =>
          item.template.id === template.id
            ? { ...item, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) }
            : item
        )
      }

      return [
        ...currentItems,
        { template, quantity: 1, serviceFeePerUnitCents: 0 },
      ]
    })
  }

  const updateQuantity = (templateId: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setFeeDrafts((currentDrafts) => {
        const remainingDrafts = { ...currentDrafts }

        delete remainingDrafts[templateId]

        return remainingDrafts
      })
    }

    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.template.id === templateId
            ? {
                ...item,
                quantity: Math.min(Math.max(nextQuantity, 0), MAX_QUANTITY),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const updateServiceFeeDraft = (templateId: string, yuanValue: string) => {
    if (!MONEY_DRAFT_PATTERN.test(yuanValue)) {
      return
    }

    setFeeDrafts((currentDrafts) => ({
      ...currentDrafts,
      [templateId]: yuanValue,
    }))
  }

  const normalizeServiceFee = (templateId: string, yuanValue: string) => {
    const nextCents = parseMoneyDraftToCents(yuanValue)

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.template.id === templateId
          ? { ...item, serviceFeePerUnitCents: nextCents }
          : item
      )
    )
    setFeeDrafts((currentDrafts) => ({
      ...currentDrafts,
      [templateId]: yuanValue === "" ? "" : formatYuanInput(nextCents),
    }))
  }

  const normalizeAllServiceFees = (): ErrandCartItem[] => {
    const normalizedItems = items.map((item) => {
      const draft =
        feeDrafts[item.template.id] ??
        formatYuanInput(item.serviceFeePerUnitCents)

      return {
        ...item,
        serviceFeePerUnitCents: parseMoneyDraftToCents(draft),
      }
    })
    const normalizedDrafts = normalizedItems.reduce<Record<string, string>>(
      (drafts, item) => {
        const draft =
          feeDrafts[item.template.id] ??
          formatYuanInput(item.serviceFeePerUnitCents)

        drafts[item.template.id] =
          draft === "" ? "" : formatYuanInput(item.serviceFeePerUnitCents)

        return drafts
      },
      {}
    )

    setItems(normalizedItems)
    setFeeDrafts(normalizedDrafts)

    return normalizedItems
  }

  const submitDemand = async () => {
    if (submittingRef.current) {
      return
    }

    if (items.length === 0) {
      toast.error("跑腿清单不能为空")
      return
    }

    const normalizedItems = normalizeAllServiceFees()
    const deadline = new Date(deadlineValue)

    if (
      Number.isNaN(deadline.getTime()) ||
      !isValidErrandDeadline(deadline)
    ) {
      toast.error("期望送达时间至少需要在 2 小时后")
      return
    }

    const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl }

    submittingRef.current = true
    setSubmitting(true)
    try {
      await createErrandDemand(
        {
          storeId: store.id,
          deadline: deadline.toISOString(),
          items: normalizedItems.map((item) => ({
            productTemplateId: item.template.id,
            quantity: item.quantity,
            serviceFeePerUnitCents: item.serviceFeePerUnitCents,
            updatedAt: item.template.updatedAt,
          })),
        },
        serviceOptions
      )
      toast.success("跑腿需求已发起")
      setItems([])
      setFeeDrafts({})
      setCartOpen(false)
      router.push("/orders?source=errand&perspective=purchaser")
    } catch {
      toast.error("跑腿需求提交失败，请稍后再试")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
      <section className="flex items-start gap-3 rounded-lg border bg-card p-3">
        <ManagedImage
          src={store.logoUrl}
          alt={store.name}
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-7">
                {store.name}
              </h1>
              <p className="mt-0.5 flex items-start gap-1.5 text-sm leading-5 text-muted-foreground">
                <RiStore2Line className="mt-0.5 size-4 shrink-0" />
                <span className="line-clamp-2">{store.address}</span>
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              跑腿
            </Badge>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-10 flex items-start gap-2 rounded-lg border bg-card p-3">
        <RiInformationLine className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-5">发起跑腿需求</h2>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            选择商品模板，设置数量、单件跑腿费与期望送达时间。
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">商品模板</h2>
          <span className="text-sm text-muted-foreground">
            {templates.length} 个可选
          </span>
        </div>

        {templates.length === 0 ? (
          <Empty
            icon={<RiShoppingBag3Line className="size-5" />}
            title="此店铺暂无可用商品模板"
            description="可以返回团购页选择其他店铺。"
          />
        ) : (
          <div className="columns-1 gap-3 md:columns-2">
            {templates.map((template) => {
              const cartItem = cartByTemplateId.get(template.id)

              return (
                <Card
                  key={template.id}
                  className="mb-3 flex break-inside-avoid gap-3 p-3"
                >
                  <button
                    type="button"
                    className="block shrink-0 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => setSelectedTemplate(template)}
                    aria-label={`查看${template.title}详情`}
                  >
                    <ManagedImage
                      src={template.mainImageUrl}
                      alt={template.title}
                      className="size-20 rounded-lg"
                    />
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 text-left outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50"
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5">
                            {template.title}
                          </h3>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`查看${template.title}详情`}
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <RiInformationLine />
                        </Button>
                      </div>
                      {template.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {template.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">
                          {formatPrice(template.priceCents)}
                        </p>
                        <Badge variant="muted" className="mt-1">
                          店铺标价
                        </Badge>
                      </div>

                      {cartItem ? (
                        <QuantityControl
                          title={template.title}
                          quantity={cartItem.quantity}
                          onDecrement={() =>
                            updateQuantity(template.id, cartItem.quantity - 1)
                          }
                          onIncrement={() =>
                            updateQuantity(template.id, cartItem.quantity + 1)
                          }
                        />
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => addItem(template)}
                        >
                          <RiAddLine data-icon="inline-start" />
                          加入清单
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10 mt-auto rounded-lg border bg-card p-2">
        <Button
          type="button"
          disabled={totalCount === 0}
          className="h-12 w-full justify-between px-3"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <RiShoppingCartLine className="size-5 shrink-0" />
            <span className="truncate">
              {totalCount > 0 ? `${totalCount} 件商品` : "跑腿清单"}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm font-semibold">
            {totalCount > 0
              ? formatPrice(estimatedTotalCents)
              : "选择商品后发起需求"}
          </span>
        </Button>
      </div>

      <ResponsiveDialog
        open={selectedTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplate(null)
        }}
      >
        {selectedTemplate ? (
          <ResponsiveDialogContent className="max-h-[88dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle>
                {selectedTemplate.title}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                商品标价仅用于预估，最终金额以团长实际采购结果为准。
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="min-h-0 overflow-y-auto">
              <div className="flex flex-col gap-4 pb-2">
                <ManagedImage
                  src={selectedTemplate.mainImageUrl}
                  alt={selectedTemplate.title}
                  className="aspect-video rounded-lg"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold text-primary">
                      {formatPrice(selectedTemplate.priceCents)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      店铺标价
                    </p>
                  </div>
                  <Badge variant="secondary">商品模板</Badge>
                </div>
                <InfoRow
                  label="商品规格"
                  value={selectedTemplate.description || "暂无规格说明"}
                />
                <InfoRow
                  label="条码编号"
                  value={selectedTemplate.barcode || "暂无条码编号"}
                />
              </div>
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
              >
                关闭
              </Button>
              <Button
                type="button"
                onClick={() => {
                  addItem(selectedTemplate)
                  setSelectedTemplate(null)
                }}
              >
                <RiAddLine data-icon="inline-start" />
                加入清单
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>

      <ResponsiveDialog
        forceDrawer
        open={cartOpen}
        onOpenChange={(open) => {
          if (!submitting) setCartOpen(open)
        }}
      >
        <ResponsiveDialogContent className="max-h-[88dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>跑腿清单</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              商品标价不是最终支付价格，结算以团长采购结果为准。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <Empty
                icon={<RiShoppingCartLine className="size-5" />}
                title="跑腿清单不能为空"
                description="先选择要采购的商品模板。"
              />
            ) : (
              <div className="flex flex-col gap-4 pb-2">
                <div className="flex flex-col divide-y rounded-lg border">
                  {items.map((item) => (
                    <div
                      key={item.template.id}
                      className="flex flex-col gap-3 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <ManagedImage
                          src={item.template.mainImageUrl}
                          alt={item.template.title}
                          className="size-14 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-5">
                            {item.template.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatPrice(item.template.priceCents)} / 件
                          </p>
                        </div>
                        <QuantityControl
                          title={item.template.title}
                          quantity={item.quantity}
                          onDecrement={() =>
                            updateQuantity(
                              item.template.id,
                              item.quantity - 1
                            )
                          }
                          onIncrement={() =>
                            updateQuantity(
                              item.template.id,
                              item.quantity + 1
                            )
                          }
                        />
                      </div>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        跑腿费/件
                        <InputGroup>
                          <InputGroupAddon>
                            <InputGroupText>¥</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            type="text"
                            inputMode="decimal"
                            value={
                              feeDrafts[item.template.id] ??
                              formatYuanInput(item.serviceFeePerUnitCents)
                            }
                            aria-label={`${item.template.title}跑腿费每件`}
                            onChange={(event) =>
                              updateServiceFeeDraft(
                                item.template.id,
                                event.target.value
                              )
                            }
                            onBlur={(event) =>
                              normalizeServiceFee(
                                item.template.id,
                                event.target.value
                              )
                            }
                          />
                        </InputGroup>
                      </label>
                    </div>
                  ))}
                </div>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  期望送达时间
                  <Input
                    type="datetime-local"
                    value={deadlineValue}
                    onChange={(event) => setDeadlineValue(event.target.value)}
                  />
                </label>

                <div className="rounded-lg border bg-secondary/60 p-3 text-sm">
                  <TotalRow
                    label="商品标价合计"
                    value={formatPrice(totalOriginAmountCents)}
                  />
                  <TotalRow
                    label="跑腿费合计"
                    value={formatPrice(totalServiceFeeCents)}
                  />
                  <TotalRow
                    label="预估合计"
                    value={formatPrice(estimatedTotalCents)}
                    strong
                  />
                </div>
              </div>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              className="w-full"
              disabled={items.length === 0 || submitting}
              onClick={() => {
                void submitDemand()
              }}
            >
              {submitting ? "正在提交" : "确认发起跑腿需求"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
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
      <span className="min-w-7 text-center text-sm font-semibold">
        {quantity}
      </span>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  )
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  )
}

function formatYuanInput(cents: number): string {
  if (cents === 0) {
    return "0"
  }

  return (cents / 100).toFixed(2)
}

function parseMoneyDraftToCents(value: string): number {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 0
  }

  return Math.max(0, Math.round(parsedValue * 100))
}
