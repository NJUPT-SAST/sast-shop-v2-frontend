"use client"

import { useEffect, useMemo, useState } from "react"
import {
  RiCheckboxCircleLine,
  RiStore2Line,
} from "@remixicon/react"
import {
  createSpotOrders,
  listPaymentQrCodes,
  type DataSource,
  type ServiceOptions,
  type SpotGoods,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
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
  readDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences"
import { ManagedImage } from "./managed-image"
import { PaymentDialog } from "./payment-dialog"

type SpotProduct = {
  id: string
  title: string
  description: string
  price: number
  originalPrice: number
  stock: number | null
  sellerId: string | null
  seller: string
  barcode: string
  imageUrl: string
  updatedAt: string | null
}

export function SpotMarketplace({
  dataSource,
  connectBaseUrl,
  products,
  error,
}: {
  dataSource: DataSource
  connectBaseUrl: string
  products: SpotGoods[]
  error: string | null
}) {
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl }
  const spotGoods = useMemo(
    () =>
      products.map((goods) => ({
        id: goods.id,
        title: goods.product.title,
        description: goods.product.description,
        price: goods.salePriceCents,
        originalPrice: goods.product.priceCents,
        stock: goods.stock,
        sellerId: goods.sellerId,
        seller: goods.sellerName ?? "发布者",
        barcode: goods.product.barcode,
        imageUrl: goods.product.mainImageUrl,
        updatedAt: goods.updatedAt,
      })),
    [products]
  )
  const [selectedProduct, setSelectedProduct] = useState<SpotProduct | null>(
    null
  )
  const [checkoutDraft, setCheckoutDraft] = useState<{
    product: SpotProduct
    quantity: number
  } | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [query, setQuery] = useState("")
  const [defaultPlatform, setDefaultPlatform] =
    useState<PaymentPlatform>("wechat")
  const [paymentQrCodes, setPaymentQrCodes] = useState<
    Partial<Record<PaymentPlatform, string>>
  >({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const availableProducts = useMemo(
    () => spotGoods.filter((product) => product.stock === null || product.stock > 0),
    [spotGoods]
  )
  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()

    if (!keyword) {
      return availableProducts
    }

    return availableProducts.filter((product) =>
      [
        product.title,
        product.description,
        product.seller,
        product.barcode,
      ].some((value) => value.toLocaleLowerCase().includes(keyword))
    )
  }, [availableProducts, query])

  const maxQuantity = selectedProduct?.stock ?? 99
  const isOutOfStock = selectedProduct?.stock === 0

  useEffect(() => {
    let isMounted = true

    void Promise.resolve().then(() => {
      if (isMounted) {
        setDefaultPlatform(readDefaultPaymentPlatform())
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  function closeDetail() {
    setSelectedProduct(null)
    setQuantity(1)
  }

  async function startCheckout() {
    if (!selectedProduct) return

    if (!selectedProduct.sellerId) {
      toast.error("发布者收款信息暂不可用")
      return
    }

    setSubmitting(true)

    try {
      const currentDefaultPlatform = readDefaultPaymentPlatform()
      setDefaultPlatform(currentDefaultPlatform)
      setPaymentQrCodes({})

      const qrCodes = await listPaymentQrCodes({
        ...serviceOptions,
        ownerId: selectedProduct.sellerId,
      })

      setPaymentQrCodes(
        qrCodes.reduce<Partial<Record<PaymentPlatform, string>>>(
          (mappedQrCodes, qrCode) => ({
            ...mappedQrCodes,
            [qrCode.channel]: qrCode.content,
          }),
          {}
        )
      )
      setCheckoutDraft({ product: selectedProduct, quantity })
      setSelectedProduct(null)
      setSubmitted(false)
    } catch {
      toast.error("收款码暂不可用，请稍后再试")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitOrder() {
    if (!checkoutDraft || submitting || submitted) return

    setSubmitting(true)

    try {
      await createSpotOrders(
        [
          {
            spotGoodsId: checkoutDraft.product.id,
            quantity: checkoutDraft.quantity,
            updatedAt: checkoutDraft.product.updatedAt,
          },
        ],
        serviceOptions
      )
      setSubmitted(true)
      toast.success("订单已提交，等待收款确认")
    } catch {
      toast.error("订单提交失败，请稍后再试")
    } finally {
      setSubmitting(false)
    }
  }

  const amount = checkoutDraft
    ? checkoutDraft.product.price * checkoutDraft.quantity
    : 0
  const verifyCode = checkoutDraft
    ? String((4821 + Number(checkoutDraft.product.id || 0)) % 10000).padStart(4, "0")
    : "4821"

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold md:text-2xl">现货商城</h1>
          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : null}
        </div>
        <div className="rounded-lg border px-3 py-2 md:w-36">
          <p className="text-xs text-muted-foreground">在售现货</p>
          <p className="truncate text-sm font-semibold">
            {availableProducts.length} 件
          </p>
        </div>
      </section>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索商品、规格、卖家或条码"
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            className="text-left"
            onClick={() => {
              setSelectedProduct(product)
              setQuantity(1)
            }}
          >
            <Card className="h-full overflow-hidden rounded-lg transition-colors hover:bg-muted/30">
              <ManagedImage
                src={product.imageUrl}
                alt={product.title}
                className="aspect-square"
              />
              <CardHeader className="gap-1 px-3 pt-3">
                <CardTitle className="line-clamp-2 text-sm leading-snug">
                  {product.title}
                </CardTitle>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {product.description}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 px-3 pb-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-semibold text-primary">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RiStore2Line className="size-3.5 shrink-0" />
                  <span className="truncate">{product.seller}</span>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </section>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
            暂无匹配的在售现货，请换个关键词试试。
          </CardContent>
        </Card>
      ) : null}

      <ResponsiveDialog
        open={selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail()
        }}
      >
        {selectedProduct ? (
          <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle>{selectedProduct.title}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                现货直接进入支付，不加入跑腿购物车。
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className="flex flex-col gap-4">
              <ManagedImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.title}
                className="aspect-video rounded-lg"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-primary">
                    {formatPrice(selectedProduct.price)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    售卖人：{selectedProduct.seller}
                  </p>
                </div>
                <Badge variant="secondary">
                  {selectedProduct.stock === null
                    ? "库存以发布者确认为准"
                    : `库存 ${selectedProduct.stock}`}
                </Badge>
              </div>
              <InfoRow label="商品规格" value={selectedProduct.description} />
              <InfoRow label="条码编号" value={selectedProduct.barcode} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">购买数量</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((value) => value - 1)}
                  >
                    -
                  </Button>
                  <span className="min-w-6 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={quantity >= maxQuantity}
                    onClick={() => setQuantity((value) => value + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={closeDetail}>
                取消
              </Button>
              <Button
                type="button"
                disabled={isOutOfStock || submitting}
                onClick={() => {
                  void startCheckout()
                }}
              >
                <RiCheckboxCircleLine data-icon="inline-start" />
                {submitting ? "获取收款码" : "立即购买"}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>

      <PaymentDialog
        open={checkoutDraft !== null}
        onOpenChange={(open) => {
          if (!open) setCheckoutDraft(null)
        }}
        amountCents={amount}
        verifyCode={verifyCode}
        qrCodes={paymentQrCodes}
        defaultPlatform={defaultPlatform}
        submitting={submitting || submitted}
        onCancelPayment={() => {
          setCheckoutDraft(null)
          toast.message("已取消支付")
        }}
        onPay={() => {
          void submitOrder()
        }}
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  )
}
