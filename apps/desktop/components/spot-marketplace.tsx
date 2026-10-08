"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiSearchLine, RiShoppingBag3Line } from "@remixicon/react";
import {
  createSpotOrders,
  getSpotGoods,
  listSpotGoods,
  type DataSource,
  type ListSpotGoodsResult,
  type SpotGoodsBrief,
} from "@sast-shop/api";
import { formatPrice, hasMoreSpotGoods } from "@sast-shop/domain";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { QuantityStepper } from "@workspace/ui/components/quantity-stepper";
import { toast } from "sonner";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";

import {
  clampPurchaseQuantity,
  mapSpotProductBriefs,
  mapSpotProductDetail,
  type SpotProduct,
  type SpotProductBrief,
} from "@/lib/spot-marketplace";
import { ManagedImage } from "./managed-image";
import { useTransactionAgreement } from "./transaction-agreement-provider";

export function SpotMarketplace({
  dataSource,
  connectBaseUrl,
  initialPage,
  error,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  initialPage: ListSpotGoodsResult;
  error: string | null;
}) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const [query, setQuery] = useState("");
  const keyword = query.trim();
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timeout);
  }, [keyword]);
  const search = useCachedResource({
    cacheKey: JSON.stringify([
      "desktop:spot-search",
      dataSource,
      connectBaseUrl,
      initialPage.pageSize,
      debouncedKeyword,
    ]),
    staleTime: 30_000,
    refreshKey: initialPage,
    load: () =>
      debouncedKeyword
        ? listSpotGoods({
            dataSource,
            connectBaseUrl,
            page: 1,
            pageSize: initialPage.pageSize,
            keyword: debouncedKeyword,
          })
        : Promise.resolve(initialPage),
  });
  const searching =
    keyword !== debouncedKeyword || Boolean(keyword && !search.data);
  const searchError =
    keyword === debouncedKeyword && keyword && search.error
      ? "搜索暂不可用，请稍后重试"
      : null;
  const resultPage = keyword ? search.data : initialPage;
  const firstPage = useMemo(
    () =>
      !searching && resultPage
        ? {
            items: resultPage.goods,
            currentPage: resultPage.currentPage,
            pageSize: resultPage.pageSize,
            totalCount: resultPage.totalCount,
            hasMore: hasMoreSpotGoods(resultPage),
          }
        : {
            items: [],
            currentPage: 1,
            pageSize: initialPage.pageSize,
            totalCount: 0,
            hasMore: false,
          },
    [initialPage.pageSize, resultPage, searching],
  );
  const loadPage = useCallback(
    async (page: number) => {
      const result = await listSpotGoods({
        dataSource,
        connectBaseUrl,
        page,
        pageSize: initialPage.pageSize,
        keyword: debouncedKeyword,
      });
      return {
        items: result.goods,
        currentPage: result.currentPage,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        hasMore: hasMoreSpotGoods(result),
      };
    },
    [connectBaseUrl, dataSource, initialPage.pageSize, debouncedKeyword],
  );
  const {
    items: loadedGoods,
    loadingMore,
    loadMoreError,
    hasMore,
    totalCount,
    loadMore,
  } = useInfinitePage({
    initialPage: firstPage,
    loadPage,
    getKey: getSpotGoodsKey,
    identity: JSON.stringify([dataSource, connectBaseUrl, keyword]),
  });

  const products = useMemo(
    () => mapSpotProductBriefs(loadedGoods),
    [loadedGoods],
  );
  const [selectedBrief, setSelectedBrief] = useState<SpotProductBrief | null>(
    null,
  );
  const [selected, setSelected] = useState<SpotProduct | null>(null);
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [unverifiedOrderVersion, setUnverifiedOrderVersion] = useState<
    string | null
  >(null);
  const submittingRef = useRef(false);
  const detailRequestRef = useRef(0);

  function setDialogOpen(open: boolean) {
    if (!open && !submittingRef.current) {
      detailRequestRef.current += 1;
      setSelectedBrief(null);
      setSelected(null);
      setDetailStatus("idle");
      setQuantity(1);
    }
  }

  async function openDetail(product: SpotProductBrief) {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedBrief(product);
    setSelected(null);
    setDetailStatus("loading");
    setQuantity(1);

    try {
      const detail = await getSpotGoods(product.id, {
        dataSource,
        connectBaseUrl,
      });
      if (
        detailRequestRef.current !== requestId ||
        detail.product.storeId !== product.storeId
      ) {
        if (detailRequestRef.current === requestId) setDetailStatus("error");
        return;
      }

      setSelected(mapSpotProductDetail(product, detail));
      setDetailStatus("idle");
    } catch {
      if (detailRequestRef.current === requestId) setDetailStatus("error");
    }
  }

  async function createOrder() {
    if (!selected || submittingRef.current) return;
    const product = selected;
    const orderVersion = `${product.id}:${product.updatedAt}`;
    if (unverifiedOrderVersion === orderVersion) return;
    const orderQuantity = quantity;
    if (!(await ensureAgreement(() => setDialogOpen(false)))) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const orders = await createSpotOrders(
        [
          {
            spotGoodsId: product.id,
            quantity: orderQuantity,
            updatedAt: product.updatedAt,
          },
        ],
        { dataSource, connectBaseUrl },
      );
      const order = orders[0];
      if (!order?.id) throw new Error("订单创建结果为空");
      toast.success("订单已创建，请继续完成支付");
      router.push(
        `/orders/spot/${order.id}?view=buyer&returnTo=${encodeURIComponent("/shop")}`,
      );
    } catch (error) {
      setUnverifiedOrderVersion(orderVersion);
      toast.error(
        error instanceof Error
          ? `${error.message}，请先到订单核对结果`
          : "创建结果暂无法确认，请先到订单核对结果",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">商城</h1>
        </div>
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon>
            <RiSearchLine />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="搜索现货商品"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索商品、店铺或条码"
          />
        </InputGroup>
      </section>

      {error || searchError ? (
        <LoadFailure
          title="现货商品加载失败"
          description={error ?? searchError ?? undefined}
          onRetry={() => (error ? router.refresh() : void search.refresh())}
        />
      ) : products.length === 0 && !searching && !loadingMore && !hasMore ? (
        <Empty
          icon={<RiShoppingBag3Line className="size-5" />}
          title={query ? "没有匹配的商品" : "暂无在售现货"}
          action={
            query ? (
              <Button variant="outline" onClick={() => setQuery("")}>
                清空搜索
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {products.map((product, index) => (
            <Card key={product.id} className="min-w-0 overflow-hidden py-0">
              <ManagedImage
                src={product.imageUrl}
                loading={index < 4 ? "eager" : "lazy"}
                sizes="(max-width: 1024px) 45vw, (max-width: 1280px) 30vw, 280px"
                alt={product.title}
                fit="contain"
                className="aspect-[16/9] w-full"
              />
              <CardContent className="min-w-0 space-y-3 px-5 pt-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">
                    {product.title}
                  </h2>
                  {product.description ? (
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                      {product.description}
                    </p>
                  ) : (
                    <div className="min-h-10" />
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xl font-semibold text-primary">
                    {formatPrice(product.salePriceCents)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-3 px-5 pb-5">
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {product.storeName}
                </span>
                <Button
                  aria-label={`选购${product.title}`}
                  onClick={() => {
                    void openDetail(product);
                  }}
                >
                  选购
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>
      )}

      {!error && !searchError ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={searching || loadingMore}
          error={loadMoreError}
          hasItems={totalCount > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<SpotGoodsLoadingSkeletons />}
          endMessage={
            query.trim()
              ? `搜索完成，共找到 ${totalCount} 件商品`
              : `已经到底，共 ${loadedGoods.length} 件商品`
          }
        />
      ) : null}

      <Dialog open={Boolean(selectedBrief)} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          {selectedBrief ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedBrief.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  商品详情与购买操作
                </DialogDescription>
              </DialogHeader>
              {detailStatus === "loading" ? (
                <div className="flex min-h-72 items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              ) : detailStatus === "error" || !selected ? (
                <LoadFailure
                  className="min-h-64"
                  surface="plain"
                  title="商品详情加载失败"
                  onRetry={() => void openDetail(selectedBrief)}
                />
              ) : (
                <>
                  <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-6">
                    <ManagedImage
                      src={selected.imageUrl}
                      sizes="(max-width: 640px) calc(100vw - 48px), 320px"
                      alt={selected.title}
                      fit="contain"
                      preview
                      className="aspect-square w-full rounded-lg"
                    />
                    <div className="min-w-0 space-y-4">
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-semibold text-primary">
                          {formatPrice(selected.salePriceCents)}
                        </p>
                        {selected.originalPriceCents >
                        selected.salePriceCents ? (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(selected.originalPriceCents)}
                          </span>
                        ) : null}
                      </div>
                      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">店铺</dt>
                        <dd className="truncate">{selected.storeName}</dd>
                        {selected.storeAddress ? (
                          <>
                            <dt className="text-muted-foreground">地址</dt>
                            <dd className="truncate">
                              {selected.storeAddress}
                            </dd>
                          </>
                        ) : null}
                        <dt className="text-muted-foreground">售卖人</dt>
                        <dd className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-7">
                            {selected.sellerAvatarUrl ? (
                              <AvatarImage
                                src={selected.sellerAvatarUrl}
                                alt=""
                              />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {selected.sellerName.trim().slice(0, 1) || "人"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {selected.sellerName}
                          </span>
                        </dd>
                        <dt className="text-muted-foreground">库存</dt>
                        <dd>{selected.stock}</dd>
                      </dl>
                      {selected.stock > 0 ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            购买数量
                          </span>
                          <QuantityStepper
                            label="购买数量"
                            value={quantity}
                            max={selected.stock}
                            onValueChange={(value) =>
                              setQuantity(
                                clampPurchaseQuantity(value, selected.stock),
                              )
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {unverifiedOrderVersion ===
                  `${selected.id}:${selected.updatedAt}` ? (
                    <p className="text-sm text-muted-foreground">
                      创建结果待核实。请先到订单查看，避免重复下单。
                    </p>
                  ) : null}
                  <DialogFooter>
                    {unverifiedOrderVersion ===
                    `${selected.id}:${selected.updatedAt}` ? (
                      <Button variant="outline" asChild>
                        <Link href="/orders?type=spot&view=buyer">
                          查看我的订单
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      onClick={createOrder}
                      disabled={
                        submitting ||
                        selected.stock === 0 ||
                        unverifiedOrderVersion ===
                          `${selected.id}:${selected.updatedAt}`
                      }
                    >
                      {submitting ? <Spinner /> : null}
                      {selected.stock === 0
                        ? "暂时售罄"
                        : `创建订单 · ${formatPrice(selected.salePriceCents * quantity)}`}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpotGoodsLoadingSkeletons() {
  return (
    <div
      className="grid grid-cols-2 gap-4 xl:grid-cols-3"
      aria-label="正在加载更多商品"
      aria-live="polite"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="overflow-hidden py-0">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <CardContent className="space-y-3 px-5 pt-4">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-6 w-1/3" />
          </CardContent>
          <CardFooter className="justify-between px-5 pb-5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-9 w-16" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function getSpotGoodsKey(goods: SpotGoodsBrief) {
  return goods.id;
}
