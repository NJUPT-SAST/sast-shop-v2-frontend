"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RiAddLine, RiSearchLine, RiShoppingBag3Line, RiSubtractLine } from "@remixicon/react"
import { createSpotOrders, type DataSource, type SpotGoods } from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Empty } from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "sonner"

import {
  clampPurchaseQuantity,
  filterSpotProducts,
  mapSpotProducts,
  type SpotProduct,
} from "@/lib/spot-marketplace"
import { ManagedImage } from "./managed-image"

export function SpotMarketplace({
  dataSource,
  connectBaseUrl,
  goods,
  error,
}: {
  dataSource: DataSource
  connectBaseUrl: string
  goods: SpotGoods[]
  error: string | null
}) {
  const router = useRouter()
  const products = useMemo(() => mapSpotProducts(goods), [goods])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<SpotProduct | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const filtered = useMemo(() => filterSpotProducts(products, query), [products, query])

  function setDialogOpen(open: boolean) {
    if (!open && !submitting) {
      setSelected(null)
      setQuantity(1)
    }
  }

  async function createOrder() {
    if (!selected || !selected.updatedAt || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const orders = await createSpotOrders(
        [{ spotGoodsId: selected.id, quantity, updatedAt: selected.updatedAt }],
        { dataSource, connectBaseUrl },
      )
      const order = orders[0]
      if (!order?.id) throw new Error("订单创建结果为空")
      toast.success("订单已创建，请继续完成支付")
      router.push(`/orders/spot/${order.id}?view=buyer&returnTo=${encodeURIComponent("/shop")}`)
    } catch {
      toast.error("创建订单失败，商品信息可能已更新，请刷新后重试")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">现货商城</h1>
        </div>
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon><RiSearchLine /></InputGroupAddon>
          <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品、卖家或条码" />
        </InputGroup>
      </section>

      {error ? (
        <Empty
          title="现货商品暂时无法加载"
          description={error}
          action={<Button variant="outline" onClick={() => router.refresh()}>重新加载</Button>}
        />
      ) : filtered.length === 0 ? (
        <Empty
          icon={<RiShoppingBag3Line className="size-5" />}
          title={query ? "没有匹配的商品" : "暂无在售现货"}
          description={query ? "请尝试更换关键词。" : "商品上架后会显示在这里。"}
        />
      ) : (
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((product) => (
            <Card key={product.id} className="min-w-0 overflow-hidden py-0">
              <ManagedImage src={product.imageUrl} alt={product.title} className="aspect-[16/9] w-full" />
              <CardContent className="min-w-0 space-y-3 px-5 pt-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{product.title}</h2>
                  {product.description ? <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{product.description}</p> : <div className="min-h-10" />}
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xl font-semibold text-primary">{formatPrice(product.salePriceCents)}</span>
                  <span className="truncate text-xs text-muted-foreground">库存 {product.stock ?? "充足"}</span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-3 px-5 pb-5">
                <span className="min-w-0 truncate text-sm text-muted-foreground">{product.sellerName}</span>
                <Button onClick={() => { setSelected(product); setQuantity(1) }}>查看商品</Button>
              </CardFooter>
            </Card>
          ))}
        </section>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.title}</DialogTitle>
                <DialogDescription className={selected.description ? undefined : "sr-only"}>{selected.description || "商品详情"}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-6">
                <ManagedImage src={selected.imageUrl} alt={selected.title} className="aspect-square w-full rounded-lg" />
                <div className="min-w-0 space-y-4">
                  <div><p className="text-2xl font-semibold text-primary">{formatPrice(selected.salePriceCents)}</p>{selected.originalPriceCents > selected.salePriceCents ? <p className="text-sm text-muted-foreground line-through">原价 {formatPrice(selected.originalPriceCents)}</p> : null}</div>
                  <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">卖家</dt><dd className="truncate">{selected.sellerName}</dd>
                    <dt className="text-muted-foreground">条码</dt><dd className="truncate font-mono">{selected.barcode || "—"}</dd>
                    <dt className="text-muted-foreground">库存</dt><dd>{selected.stock ?? "充足"}</dd>
                  </dl>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">购买数量</span>
                    <ButtonGroup aria-label="购买数量">
                      <Button variant="outline" size="icon-sm" aria-label="减少购买数量" onClick={() => setQuantity((value) => clampPurchaseQuantity(value - 1, selected.stock))}><RiSubtractLine /></Button>
                      <ButtonGroupText className="w-10 px-0" aria-live="polite">{quantity}</ButtonGroupText>
                      <Button variant="outline" size="icon-sm" aria-label="增加购买数量" onClick={() => setQuantity((value) => clampPurchaseQuantity(value + 1, selected.stock))}><RiAddLine /></Button>
                    </ButtonGroup>
                  </div>
                </div>
              </div>
              {!selected.updatedAt ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">商品版本信息缺失，暂时不能下单，请刷新后重试。</p> : null}
              <DialogFooter>
                <Button onClick={createOrder} disabled={submitting || !selected.updatedAt}>{submitting ? <Spinner /> : null}创建订单 · {formatPrice(selected.salePriceCents * quantity)}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
