"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSpotGoods,
  listSellerSpotGoods,
  type DataSource,
  type ServiceOptions,
  type SpotGoods,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { RiArrowRightSLine } from "@remixicon/react";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import {
  useInfinitePage,
  type InfinitePage,
} from "@workspace/ui/hooks/use-infinite-page";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { loadCurrentUser } from "@/lib/current-user";
import { BrandIllustration } from "./brand-illustration";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { ManagedImage } from "./managed-image";
import { SpotGoodsEditor } from "./spot-goods-editor";
import { EditActionLabel } from "@workspace/ui/components/edit-action-label";

export function SellerGoodsManager({
  dataSource,
  connectBaseUrl,
  authRequired,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  authRequired: boolean;
  refreshKey: string;
}) {
  const serviceOptions = useMemo<ServiceOptions>(
    () => ({ dataSource, connectBaseUrl }),
    [dataSource, connectBaseUrl],
  );
  const user = useCachedResource({
    cacheKey: `profile:user:${JSON.stringify([dataSource, connectBaseUrl, authRequired])}`,
    load: () => loadCurrentUser(serviceOptions, authRequired),
    staleTime: Infinity,
    invalidateOnWrite: false,
    refreshKey,
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold">我上架的商品</h1>
      {user.error ? (
        <LoadFailure
          variant="page"
          title="用户信息加载失败"
          onRetry={() => void user.refresh()}
        />
      ) : user.data ? (
        <SellerGoodsList
          key={JSON.stringify([user.data.id, dataSource, connectBaseUrl])}
          sellerId={user.data.id}
          serviceOptions={serviceOptions}
          refreshKey={refreshKey}
        />
      ) : (
        <LoadingGoods />
      )}
    </div>
  );
}

function SellerGoodsList({
  sellerId,
  serviceOptions,
  refreshKey,
}: {
  sellerId: string;
  serviceOptions: ServiceOptions;
  refreshKey: string;
}) {
  const router = useRouter();
  const loadPage = useCallback(
    async (page: number): Promise<InfinitePage<SpotGoods>> => {
      const result = await listSellerSpotGoods(
        { sellerId, page, pageSize: 20 },
        serviceOptions,
      );
      return {
        items: result.goods,
        currentPage: result.currentPage,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        hasMore: result.currentPage * result.pageSize < result.totalCount,
      };
    },
    [sellerId, serviceOptions],
  );
  const resource = useCachedResource({
    cacheKey: JSON.stringify([
      "desktop:seller-goods",
      sellerId,
      serviceOptions.dataSource,
      serviceOptions.connectBaseUrl,
    ]),
    staleTime: 60_000,
    refreshKey,
    load: () => loadPage(1),
  });
  const emptyPage = useMemo<InfinitePage<SpotGoods>>(
    () => ({
      items: [],
      currentPage: 1,
      pageSize: 20,
      totalCount: 0,
      hasMore: false,
    }),
    [],
  );
  const { items, setItems, hasMore, loadingMore, loadMoreError, loadMore } =
    useInfinitePage({
      initialPage: resource.data ?? emptyPage,
      loadPage,
      getKey: getGoodsKey,
      identity: JSON.stringify([
        sellerId,
        serviceOptions.dataSource,
        serviceOptions.connectBaseUrl,
      ]),
    });
  const [selected, setSelected] = useState<SpotGoods | null>(null);
  const [detail, setDetail] = useState<SpotGoods | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const detailGeneration = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    return () => {
      detailGeneration.current += 1;
    };
  }, []);

  function closeEditor() {
    if (busyRef.current) return;
    detailGeneration.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailError(false);
  }

  async function openEditor(goods: SpotGoods, trigger?: HTMLElement) {
    if (busyRef.current) return;
    if (trigger) returnFocusRef.current = trigger;
    const generation = ++detailGeneration.current;
    setSelected(goods);
    setDetail(null);
    setDetailError(false);
    try {
      const latest = await getSpotGoods(goods.id, serviceOptions);
      if (detailGeneration.current !== generation) return;
      if (latest.sellerId !== sellerId || latest.id !== goods.id)
        throw new Error("商品归属已变化");
      setDetail(latest);
    } catch {
      if (detailGeneration.current === generation) setDetailError(true);
    }
  }

  return (
    <>
      {!resource.data && !resource.error ? <LoadingGoods /> : null}
      {resource.error ? (
        <LoadFailure
          variant={resource.data ? "compact" : "page"}
          title="商品加载失败"
          description="暂时无法完整读取你的商品，请重新加载"
          onRetry={() => void resource.refresh()}
        />
      ) : null}
      {items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((goods) => (
            <button
              key={goods.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left outline-none transition-colors hover:bg-muted/50 active:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={(event) => void openEditor(goods, event.currentTarget)}
            >
              <ManagedImage
                src={goods.product.mainImageUrl}
                alt={goods.product.title}
                className="size-16 shrink-0 rounded-lg"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="truncate text-sm font-medium">
                  {goods.product.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {goods.product.description}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">
                    {formatPrice(goods.salePriceCents)}
                  </span>
                  <Badge variant="secondary">
                    {goods.stock === 0 ? "已售罄" : `库存 ${goods.stock}`}
                  </Badge>
                </div>
              </div>
              <RiArrowRightSLine className="size-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : resource.data &&
        !resource.error &&
        !hasMore &&
        !loadingMore &&
        !loadMoreError ? (
        <Empty
          illustration={<BrandIllustration name="spot-empty" size={112} />}
          title="暂无上架商品"
        />
      ) : null}
      {resource.data ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={loadingMore}
          error={loadMoreError}
          hasItems={items.length > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<LoadingGoods />}
          endMessage="已显示全部上架商品"
          endMessageClassName="pt-6"
        />
      ) : null}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        {selected ? (
          <DialogContent
            className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-xl"
            showCloseButton={!busy}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (returnFocusRef.current?.isConnected)
                returnFocusRef.current.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (busyRef.current) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (busyRef.current) event.preventDefault();
            }}
          >
            <DialogHeader className="px-0 text-left">
              <DialogTitle>编辑现货商品</DialogTitle>
              <DialogDescription className="sr-only">
                {detail?.product.title ?? selected.product.title}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pb-2">
              <p className="text-sm font-medium">商品模板</p>
              <Button
                type="button"
                variant="ghost"
                size="touch"
                className="h-auto w-full min-w-0 justify-start gap-3 rounded-lg px-0 py-0 pr-1 text-left"
                aria-label="编辑商品模板"
                title="前往商品模板编辑"
                disabled={busy || !detail}
                onClick={() => {
                  if (!detail || busyRef.current) return;
                  returnFocusRef.current = null;
                  closeEditor();
                  router.push(
                    `/group/templates?store=${encodeURIComponent(detail.product.storeId)}&edit=${encodeURIComponent(detail.product.id)}`,
                  );
                }}
              >
                <ManagedImage
                  src={(detail ?? selected).product.mainImageUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-lg"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate font-medium leading-5">
                    {(detail ?? selected).product.title}
                  </span>
                  <span className="truncate text-xs leading-4 text-muted-foreground">
                    {(detail ?? selected).product.description}
                  </span>
                </span>
                <EditActionLabel>编辑模板</EditActionLabel>
              </Button>
            </div>
            {detailError ? (
              <LoadFailure
                surface="plain"
                title="商品详情加载失败"
                onRetry={() => void openEditor(selected)}
              />
            ) : detail ? (
              <SpotGoodsEditor
                key={detail.id}
                goods={detail}
                serviceOptions={serviceOptions}
                onCancel={closeEditor}
                onBusyChange={(value) => {
                  busyRef.current = value;
                  setBusy(value);
                }}
                onUpdated={(latest) => {
                  setDetail(latest);
                  setItems((current) =>
                    current.map((goods) =>
                      goods.id === latest.id ? latest : goods,
                    ),
                  );
                }}
              />
            ) : (
              <GoodsEditorSkeleton />
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function LoadingGoods() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="正在加载你的商品"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border bg-card p-3"
        >
          <Skeleton className="size-16 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GoodsEditorSkeleton() {
  return (
    <>
      <div
        className="grid min-h-0 flex-1 grid-cols-2 gap-5 pb-4"
        role="status"
        aria-label="正在加载商品详情"
      >
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-12 w-full" />
            {index === 1 ? <Skeleton className="h-3 w-2/3" /> : null}
          </div>
        ))}
      </div>
      <DialogFooter className="shrink-0 border-t pt-4">
        <Skeleton className="h-11 w-16" />
        <Skeleton className="h-11 w-28" />
      </DialogFooter>
    </>
  );
}

function getGoodsKey(goods: SpotGoods) {
  return goods.id;
}
