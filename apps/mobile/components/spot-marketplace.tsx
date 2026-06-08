"use client"

import { useMemo, useState } from "react"
import {
  RiAlipayLine,
  RiCheckboxCircleLine,
  RiKey2Line,
  RiStore2Line,
  RiWallet3Line,
  RiWechatPayLine,
} from "@remixicon/react"
import {
  createSpotOrders,
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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import { ManagedImage } from "./managed-image"

type PaymentPlatform = "wechat" | "alipay"

type SpotProduct = {
  id: string
  title: string
  description: string
  price: number
  originalPrice: number
  stock: number | null
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
  const [platform, setPlatform] = useState<PaymentPlatform>("wechat")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [createdOrderNo, setCreatedOrderNo] = useState<string | null>(null)
  const availableProducts = useMemo(
    () => spotGoods.filter((product) => product.stock === null || product.stock > 0),
    [spotGoods]
  )

  const maxQuantity = selectedProduct?.stock ?? 99
  const isOutOfStock = selectedProduct?.stock === 0

  function closeDetail() {
    setSelectedProduct(null)
    setQuantity(1)
  }

  function startCheckout() {
    if (!selectedProduct) return
    setCheckoutDraft({ product: selectedProduct, quantity })
    setSelectedProduct(null)
    setSubmitted(false)
    setSubmissionError(null)
    setCreatedOrderNo(null)
  }

  async function submitOrder() {
    if (!checkoutDraft) return

    setSubmitting(true)
    setSubmissionError(null)

    try {
      const orders = await createSpotOrders(
        [
          {
            spotGoodsId: checkoutDraft.product.id,
            quantity: checkoutDraft.quantity,
            updatedAt: checkoutDraft.product.updatedAt,
          },
        ],
        serviceOptions
      )
      setCreatedOrderNo(orders[0]?.orderNo ?? null)
      setSubmitted(true)
    } catch {
      setSubmissionError("订单提交失败，请稍后再试")
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
  const PlatformIcon = platform === "wechat" ? RiWechatPayLine : RiAlipayLine

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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {availableProducts.map((product) => (
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
              <Button type="button" disabled={isOutOfStock} onClick={startCheckout}>
                <RiCheckboxCircleLine data-icon="inline-start" />
                立即购买
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={checkoutDraft !== null}
        onOpenChange={(open) => {
          if (!open) setCheckoutDraft(null)
        }}
      >
        {checkoutDraft ? (
          <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle>{submitted ? "待确认收款" : "支付"}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                请核对金额、平台和付款标识码后再付款。
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className="flex flex-col gap-4">
              <Tabs
                value={platform}
                onValueChange={(value) => setPlatform(value as PaymentPlatform)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="wechat">
                    <RiWechatPayLine data-icon="inline-start" />
                    微信支付
                  </TabsTrigger>
                  <TabsTrigger value="alipay">
                    <RiAlipayLine data-icon="inline-start" />
                    支付宝
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex justify-center rounded-lg bg-muted p-5">
                <div className="grid size-36 grid-cols-5 gap-1 rounded-md bg-card p-3">
                  {Array.from({ length: 25 }, (_, index) => (
                    <span
                      key={index}
                      className={
                        index % 3 === 0 || index % 7 === 0
                          ? "rounded-sm bg-foreground"
                          : "rounded-sm bg-muted"
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <RiWallet3Line className="size-5 text-primary" />
                  <span className="text-sm text-muted-foreground">金额</span>
                </div>
                <span className="text-xl font-semibold text-primary">
                  {formatPrice(amount)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                <div className="flex items-center gap-2">
                  <RiKey2Line className="size-5 text-primary" />
                  <span className="text-sm text-muted-foreground">标识码</span>
                </div>
                <span className="font-mono text-2xl font-semibold tracking-[0.2em]">
                  {verifyCode}
                </span>
              </div>

              {submitted ? (
                <div className="rounded-lg border p-3 text-sm leading-6 text-muted-foreground">
                  {createdOrderNo
                    ? `订单 ${createdOrderNo} 已创建，请等待后续支付确认。`
                    : "订单已创建，请等待后续支付确认。"}
                </div>
              ) : null}
              {submissionError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
                  {submissionError}
                </div>
              ) : null}
            </div>

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCheckoutDraft(null)}
              >
                关闭
              </Button>
              <Button
                type="button"
                className={cn(platform === "wechat" && "bg-green-600 hover:bg-green-700")}
                disabled={submitted || submitting}
                onClick={() => {
                  void submitOrder()
                }}
              >
                <PlatformIcon data-icon="inline-start" />
                {submitting ? "提交中" : submitted ? "已提交" : "提交订单"}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>
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
