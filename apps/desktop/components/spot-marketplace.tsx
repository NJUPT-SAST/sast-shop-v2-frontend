"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { RiSearchLine, RiShoppingBag3Line } from "@remixicon/react";
import {
  createSpotOrders,
  getSpotGoods,
  listSpotGoods,
  type DataSource,
  type ListSpotGoodsResult,
} from "@sast-shop/api";
import {
  formatPrice,
  hasMoreSpotGoods,
  mergeSpotGoodsPages,
  resolveNextSpotGoodsPage,
  type SpotGoodsLoadTrigger,
} from "@sast-shop/domain";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { QuantityStepper } from "@workspace/ui/components/quantity-stepper";
import { toast } from "sonner";

import {
  clampPurchaseQuantity,
  filterSpotProducts,
  mapSpotProductBriefs,
  mapSpotProductDetail,
  type SpotProduct,
  type SpotProductBrief,
} from "@/lib/spot-marketplace";
import { ManagedImage } from "./managed-image";

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
  const [loadedGoods, setLoadedGoods] = useState(initialPage.goods);
  const [currentPage, setCurrentPage] = useState(initialPage.currentPage);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const loadingMoreRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const autoLoadSupported = useSyncExternalStore(
    emptySubscribe,
    () => "IntersectionObserver" in window,
    () => true,
  );

  const products = useMemo(
    () => mapSpotProductBriefs(loadedGoods),
    [loadedGoods],
  );
  const [query, setQuery] = useState("");
  const [selectedBrief, setSelectedBrief] = useState<SpotProductBrief | null>(
    null,
  );
  const [selected, setSelected] = useState<SpotProduct | null>(null);
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const detailRequestRef = useRef(0);
  const filtered = useMemo(
    () => filterSpotProducts(products, query),
    [products, query],
  );
  const hasMore = hasMoreSpotGoods({
    currentPage,
    pageSize: initialPage.pageSize,
    totalCount,
  });

  const loadNextPage = useCallback(
    async (trigger: SpotGoodsLoadTrigger) => {
      const nextPageNumber = resolveNextSpotGoodsPage({
        currentPage,
        pageSize: initialPage.pageSize,
        totalCount,
        loading: loadingMoreRef.current,
        loadMoreError,
        trigger,
        query,
      });
      if (nextPageNumber === null) return;

      loadingMoreRef.current = true;
      setLoadingMore(true);
      setLoadMoreError(false);

      try {
        const nextPage = await listSpotGoods({
          dataSource,
          connectBaseUrl,
          page: nextPageNumber,
          pageSize: initialPage.pageSize,
        });
        setLoadedGoods((current) =>
          mergeSpotGoodsPages(current, nextPage.goods),
        );
        setCurrentPage(nextPage.currentPage);
        setTotalCount(nextPage.totalCount);
      } catch {
        setLoadMoreError(true);
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [
      connectBaseUrl,
      currentPage,
      dataSource,
      initialPage.pageSize,
      loadMoreError,
      query,
      totalCount,
    ],
  );

  useEffect(() => {
    if (!query.trim() || !hasMore || loadMoreError) return;
    const timeout = window.setTimeout(() => {
      void loadNextPage("search");
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [hasMore, loadMoreError, loadNextPage, query]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loadMoreError || !autoLoadSupported) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage("viewport");
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [autoLoadSupported, hasMore, loadMoreError, loadNextPage]);

  function setDialogOpen(open: boolean) {
    if (!open && !submitting) {
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
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const orders = await createSpotOrders(
        [{ spotGoodsId: selected.id, quantity, updatedAt: selected.updatedAt }],
        { dataSource, connectBaseUrl },
      );
      const order = orders[0];
      if (!order?.id) throw new Error("订单创建结果为空");
      toast.success("订单已创建，请继续完成支付");
      router.push(
        `/orders/spot/${order.id}?view=buyer&returnTo=${encodeURIComponent("/shop")}`,
      );
    } catch {
      toast.error("创建订单失败，商品信息可能已更新，请刷新后重试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索商品、店铺或条码"
          />
        </InputGroup>
      </section>

      {error ? (
        <Empty
          title="现货商品暂时无法加载"
          description={error}
          action={
            <Button variant="outline" onClick={() => router.refresh()}>
              重新加载
            </Button>
          }
        />
      ) : filtered.length === 0 && !loadingMore && !hasMore ? (
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
          {filtered.map((product) => (
            <Card key={product.id} className="min-w-0 overflow-hidden py-0">
              <ManagedImage
                src={product.imageUrl}
                alt={product.title}
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

      {!error && loadingMore ? <SpotGoodsLoadingSkeletons /> : null}

      {!error && hasMore && !loadMoreError ? (
        <div
          ref={loadMoreSentinelRef}
          className="h-px w-full"
          aria-hidden="true"
        />
      ) : null}

      {!error && hasMore && !loadMoreError && !autoLoadSupported ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={() => void loadNextPage("manual")}
          >
            {loadingMore ? <Spinner /> : null}
            加载更多
          </Button>
        </div>
      ) : null}

      {!error && loadMoreError ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={() => void loadNextPage("manual")}
          >
            {loadingMore ? <Spinner /> : null}
            重新加载
          </Button>
        </div>
      ) : null}

      {!error && totalCount > 0 && !hasMore && !loadingMore ? (
        <p
          className="text-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          {query.trim()
            ? `搜索完成，共找到 ${filtered.length} 件商品`
            : `已展示全部 ${loadedGoods.length} 件商品`}
        </p>
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
                <div className="flex min-h-64 flex-col items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    商品详情暂时无法加载
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void openDetail(selectedBrief)}
                  >
                    重新加载
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-6">
                    <ManagedImage
                      src={selected.imageUrl}
                      alt={selected.title}
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
                  <DialogFooter>
                    <Button
                      onClick={createOrder}
                      disabled={submitting || selected.stock === 0}
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

function emptySubscribe() {
  return () => {};
}
