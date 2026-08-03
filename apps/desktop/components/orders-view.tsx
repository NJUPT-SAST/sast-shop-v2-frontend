"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  RiArrowRightSLine,
  RiEditLine,
  RiFileList3Line,
  RiSearchLine,
} from "@remixicon/react";
import {
  cancelErrandDemand,
  getBuyerErrandOrderDetail,
  listBuyerErrandOrdersPage,
  listErrandTasksPage,
  listSpotOrdersPage,
  BuyerErrandOrder,
  type DataSource,
  ErrandTaskBrief,
  type PageResult,
  SpotOrder,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";

import {
  DEFAULT_REMEMBERED_ORDER_VIEWS,
  getOrderFiltersFromParams,
  getStatusBadgeVariant,
  getStatusLabel,
  getStatusOptions,
  getViewOptions,
  matchesOrderStatus,
  orderTypeOptions,
  updateOrderFilterParams,
  type OrderFilters,
  type OrderStatus,
  type OrderType,
  type OrderView,
  type RememberedOrderViews,
  type RenderableOrderStatus,
} from "@/lib/order-filters";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { ManagedImage } from "./managed-image";
import { toast } from "sonner";

type RenderableOrder = {
  id: string;
  orderNo: string | null;
  type: OrderType;
  view: OrderView;
  title: string;
  store: string | null;
  status: RenderableOrderStatus;
  amount: number | null;
  summary: string;
  imageUrls: string[];
  unitPriceCents: number | null;
  quantity: number | null;
  itemCount: number;
  createdAt: string | null;
  href: string | null;
  modifyHref: string | null;
  cancelDemandId: string | null;
  isExpired: boolean;
};

const orderDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type OrdersViewProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  initialFilters: OrderFilters;
  spotBuyerPage: PageResult<SpotOrder>;
  spotSellerPage: PageResult<SpotOrder>;
  buyerErrandPage: PageResult<BuyerErrandOrder>;
  errandTaskPage: PageResult<ErrandTaskBrief>;
  errors: {
    spotBuyer: boolean;
    spotSeller: boolean;
    errandParticipant: boolean;
    errandCaptain: boolean;
  };
};

export function OrdersView({
  dataSource,
  connectBaseUrl,
  initialFilters,
  spotBuyerPage,
  spotSellerPage,
  buyerErrandPage,
  errandTaskPage,
  errors,
}: OrdersViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(initialFilters);
  const [rememberedViews, setRememberedViews] = useState<RememberedOrderViews>(
    () => rememberView(DEFAULT_REMEMBERED_ORDER_VIEWS, initialFilters),
  );
  const [now, setNow] = useState(() => new Date());
  const [cancelDemandId, setCancelDemandId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const pendingSearchHrefRef = useRef<string | null>(null);
  const loadSpotBuyerPage = useCallback(
    (page: number) =>
      listSpotOrdersPage({
        dataSource,
        connectBaseUrl,
        perspective: "purchaser",
        page,
        pageSize: spotBuyerPage.pageSize,
      }),
    [connectBaseUrl, dataSource, spotBuyerPage.pageSize],
  );
  const loadSpotSellerPage = useCallback(
    (page: number) =>
      listSpotOrdersPage({
        dataSource,
        connectBaseUrl,
        perspective: "seller",
        page,
        pageSize: spotSellerPage.pageSize,
      }),
    [connectBaseUrl, dataSource, spotSellerPage.pageSize],
  );
  const loadBuyerErrandPage = useCallback(
    (page: number) =>
      listBuyerErrandOrdersPage({
        dataSource,
        connectBaseUrl,
        page,
        pageSize: buyerErrandPage.pageSize,
      }),
    [buyerErrandPage.pageSize, connectBaseUrl, dataSource],
  );
  const loadErrandTaskPage = useCallback(
    (page: number) =>
      listErrandTasksPage({
        dataSource,
        connectBaseUrl,
        page,
        pageSize: errandTaskPage.pageSize,
      }),
    [connectBaseUrl, dataSource, errandTaskPage.pageSize],
  );
  const spotBuyerFeed = useInfinitePage({
    initialPage: spotBuyerPage,
    loadPage: loadSpotBuyerPage,
    getKey: getOrderKey,
    identity: `${dataSource}:${connectBaseUrl}:spot:buyer`,
  });
  const spotSellerFeed = useInfinitePage({
    initialPage: spotSellerPage,
    loadPage: loadSpotSellerPage,
    getKey: getOrderKey,
    identity: `${dataSource}:${connectBaseUrl}:spot:seller`,
  });
  const buyerErrandFeed = useInfinitePage({
    initialPage: buyerErrandPage,
    loadPage: loadBuyerErrandPage,
    getKey: getOrderKey,
    identity: `${dataSource}:${connectBaseUrl}:errand:participant`,
  });
  const errandTaskFeed = useInfinitePage({
    initialPage: errandTaskPage,
    loadPage: loadErrandTaskPage,
    getKey: getOrderKey,
    identity: `${dataSource}:${connectBaseUrl}:errand:captain`,
  });
  const orders = useMemo(
    () => [
      ...spotBuyerFeed.items.map((order) => mapSpotOrder(order, "buyer")),
      ...spotSellerFeed.items.map((order) => mapSpotOrder(order, "seller")),
      ...buyerErrandFeed.items.map((order) =>
        mapBuyerErrandOrder(order, now),
      ),
      ...errandTaskFeed.items.map(mapErrandTask),
    ],
    [
      buyerErrandFeed.items,
      errandTaskFeed.items,
      now,
      spotBuyerFeed.items,
      spotSellerFeed.items,
    ],
  );
  const filtered = useMemo(
    () => filterOrders(orders, filters),
    [filters, orders],
  );
  const hasError = getCurrentError(filters, errors);
  const currentFeed =
    filters.type === "spot"
      ? filters.view === "seller"
        ? spotSellerFeed
        : spotBuyerFeed
      : filters.view === "captain"
        ? errandTaskFeed
        : buyerErrandFeed;
  const {
    hasMore: currentFeedHasMore,
    loadingMore: currentFeedLoadingMore,
    loadMoreError: currentFeedLoadMoreError,
    loadMore: loadMoreCurrentFeed,
  } = currentFeed;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const shouldContinueSearching = filters.query.trim().length > 0;
    const shouldFillEmptyFilter = filtered.length === 0;

    if (
      (!shouldContinueSearching && !shouldFillEmptyFilter) ||
      !currentFeedHasMore ||
      currentFeedLoadingMore ||
      currentFeedLoadMoreError
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadMoreCurrentFeed();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [
    currentFeedHasMore,
    currentFeedLoadMoreError,
    currentFeedLoadingMore,
    filtered.length,
    filters.query,
    loadMoreCurrentFeed,
  ]);

  useEffect(() => {
    const synchronize = () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      pendingSearchHrefRef.current = null;
      const next = getOrderFiltersFromParams(
        new URLSearchParams(window.location.search),
      );
      setFilters(next);
      setRememberedViews((current) => rememberView(current, next));
    };
    window.addEventListener("popstate", synchronize);
    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
      window.removeEventListener("popstate", synchronize);
    };
  }, []);

  function update(updates: {
    type?: OrderType;
    view?: OrderView;
    status?: OrderStatus;
    q?: string;
  }) {
    const nextRemembered = updates.view
      ? rememberView(rememberedViews, { ...filters, view: updates.view })
      : rememberedViews;
    const params = updateOrderFilterParams(
      new URLSearchParams(window.location.search),
      { ...updates, rememberedViews: nextRemembered },
    );
    const nextFilters = getOrderFiltersFromParams(params);
    setFilters(nextFilters);
    setRememberedViews(rememberView(nextRemembered, nextFilters));
    const nextHref = params.size ? `${pathname}?${params}` : pathname;
    const onlySearchChanged =
      updates.q !== undefined &&
      updates.type === undefined &&
      updates.view === undefined &&
      updates.status === undefined;

    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (onlySearchChanged) {
      pendingSearchHrefRef.current = nextHref;
      searchTimerRef.current = window.setTimeout(flushSearchRoute, 250);
      return;
    }

    pendingSearchHrefRef.current = null;
    window.history.replaceState(window.history.state, "", nextHref);
  }

  function flushSearchRoute() {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    const nextHref = pendingSearchHrefRef.current;
    pendingSearchHrefRef.current = null;
    if (nextHref) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }

  async function confirmCancelDemand() {
    if (!cancelDemandId || cancelling) return;
    setCancelling(true);
    try {
      const detail = await getBuyerErrandOrderDetail(cancelDemandId, {
        dataSource,
        connectBaseUrl,
      });
      await cancelErrandDemand(cancelDemandId, {
        dataSource,
        connectBaseUrl,
        updatedAt: detail.updatedAt ?? undefined,
      });
      toast.success("跑腿需求已撤回");
      setCancelDemandId(null);
      router.refresh();
    } catch {
      toast.error("撤回失败，请刷新后重试");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">订单</h1>
        <p className="text-sm text-muted-foreground">
          {hasError ? "当前视角暂不可用" : `共 ${filtered.length} 笔`}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          value={filters.type}
          onValueChange={(value) => update({ type: value as OrderType })}
        >
          <TabsList className="w-64" aria-label="订单类型">
            {orderTypeOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon>
            <RiSearchLine />
          </InputGroupAddon>
          <InputGroupInput
            value={filters.query}
            onChange={(event) => update({ q: event.target.value })}
            onBlur={flushSearchRoute}
            onKeyDown={(event) => {
              if (event.key === "Enter") flushSearchRoute();
            }}
            placeholder="搜索订单号、商品或店铺"
            aria-label="搜索订单"
          />
        </InputGroup>
      </div>

      <Tabs
        value={filters.view}
        onValueChange={(value) => update({ view: value as OrderView })}
      >
        <TabsList aria-label="订单查看身份">
          {getViewOptions(filters.type).map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ToggleGroup
        type="single"
        value={filters.status}
        variant="outline"
        aria-label="订单状态"
        className="flex flex-wrap justify-start"
        onValueChange={(value) => {
          if (value) update({ status: value as OrderStatus });
        }}
      >
        {getStatusOptions(filters.type, filters.view).map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {hasError ? (
        <LoadFailure
          title="该视角订单加载失败"
          description="请稍后重新加载。"
          onRetry={() => router.refresh()}
        />
      ) : filtered.length === 0 &&
        !currentFeed.loadingMore &&
        !currentFeed.hasMore ? (
        <Empty
          icon={<RiFileList3Line className="size-5" />}
          title="没有符合条件的订单"
        />
      ) : filtered.length > 0 ? (
        <section className="grid min-w-0 gap-3">
          {filtered.map((order) => (
            <OrderItem
              key={order.id}
              order={order}
              onCancelDemand={
                order.cancelDemandId
                  ? () => setCancelDemandId(order.cancelDemandId!)
                  : undefined
              }
            />
          ))}
        </section>
      ) : null}

      {!hasError ? (
        <InfiniteListStatus
          hasMore={currentFeed.hasMore}
          loading={currentFeed.loadingMore}
          error={currentFeed.loadMoreError}
          hasItems={currentFeed.totalCount > 0}
          onLoadMore={() => void currentFeed.loadMore()}
          loadingFallback={<OrderLoadingSkeletons />}
          endMessage={`已经到底，共 ${currentFeed.items.length} 笔订单`}
        />
      ) : null}

      <Dialog
        open={cancelDemandId !== null}
        onOpenChange={(open) => !cancelling && !open && setCancelDemandId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤回跑腿需求？</DialogTitle>
            <DialogDescription>
              撤回后该需求将从跑腿大厅移除，团长将无法接单。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setCancelDemandId(null)}
            >
              保留需求
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void confirmCancelDemand()}
            >
              {cancelling ? "正在撤回…" : "撤回需求"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderLoadingSkeletons() {
  return (
    <div className="grid min-w-0 gap-3" aria-label="正在加载更多订单">
      {Array.from({ length: 3 }, (_, index) => (
        <Item key={index} variant="outline" aria-hidden="true">
          <Skeleton className="size-14 shrink-0 rounded-lg" />
          <ItemContent className="gap-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}

function getOrderKey(order: { id: string }) {
  return order.id;
}

function OrderItem({
  order,
  onCancelDemand,
}: {
  order: RenderableOrder;
  onCancelDemand?: () => void;
}) {
  const statusLabel = order.isExpired
    ? "已过期"
    : getStatusLabel(order.status, order.view);
  const statusVariant = order.isExpired
    ? "danger"
    : getStatusBadgeVariant(order.status);
  const content = (
    <Item
      variant="outline"
      className="min-w-0 p-4 transition-colors hover:bg-muted/40"
    >
      <OrderThumbnails order={order} />
      <ItemContent className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ItemTitle className="min-w-0 truncate text-base">
            {order.title}
          </ItemTitle>
          <Badge variant={statusVariant} className="shrink-0">
            {statusLabel}
          </Badge>
        </div>
        {order.store || order.orderNo ? (
          <ItemDescription className="truncate">
            {order.store}
            {order.store && order.orderNo ? (
              <span aria-hidden="true"> · </span>
            ) : null}
            {order.orderNo ? (
              <span className="font-mono tabular-nums">{order.orderNo}</span>
            ) : null}
          </ItemDescription>
        ) : null}
        <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {order.unitPriceCents !== null ? (
            <span className="tabular-nums">
              {formatPrice(order.unitPriceCents)}
              {order.quantity !== null ? ` × ${order.quantity}` : null}
            </span>
          ) : null}
          {order.itemCount > 1 ? <span>{order.itemCount} 种商品</span> : null}
          {formatOrderDate(order.createdAt) ? (
            <span>创建于 {formatOrderDate(order.createdAt)}</span>
          ) : null}
        </ItemDescription>
      </ItemContent>
      <div className="grid min-w-0 shrink-0 grid-cols-[minmax(7rem,11rem)_8rem] items-center gap-6 text-right">
        <span className="truncate text-sm text-muted-foreground">
          {order.summary}
        </span>
        <div className="flex min-w-0 flex-col items-end gap-2">
          <span className="truncate font-semibold">
            {order.amount === null ? null : formatPrice(order.amount)}
          </span>
          {order.modifyHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={order.modifyHref} prefetch={false}>
                <RiEditLine data-icon="inline-start" />
                修改需求
              </Link>
            </Button>
          ) : null}
          {onCancelDemand ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={onCancelDemand}
            >
              撤回
            </Button>
          ) : null}
        </div>
      </div>
      {order.href && order.modifyHref ? (
        <ItemActions>
          <Button
            asChild
            size="icon-sm"
            variant="ghost"
            aria-label="查看订单详情"
          >
            <Link href={order.href} prefetch={false}>
              <RiArrowRightSLine className="size-5" />
            </Link>
          </Button>
        </ItemActions>
      ) : order.href ? (
        <ItemActions>
          <RiArrowRightSLine className="size-5 text-muted-foreground" />
        </ItemActions>
      ) : null}
    </Item>
  );

  if (!order.href) return <div className="opacity-60">{content}</div>;
  if (order.modifyHref) return <div className="block min-w-0">{content}</div>;

  return (
    <Link
      href={order.href}
      prefetch={false}
      className="block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  );
}

function OrderThumbnails({ order }: { order: RenderableOrder }) {
  const imageUrls = order.imageUrls.slice(0, 3);

  if (imageUrls.length <= 1) {
    return (
      <ManagedImage
        src={imageUrls[0]}
        alt={order.title}
        className="size-14 shrink-0 rounded-lg"
      />
    );
  }

  return (
    <div className="flex shrink-0 -space-x-3" aria-label="商品图片">
      {imageUrls.map((src, index) => (
        <ManagedImage
          key={`${src}-${index}`}
          src={src}
          alt={`${order.title} 商品 ${index + 1}`}
          className="size-12 rounded-lg border-2 border-card"
        />
      ))}
    </div>
  );
}

function formatOrderDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : orderDateFormatter.format(date);
}

function mapSpotOrder(
  order: SpotOrder,
  view: "buyer" | "seller",
): RenderableOrder {
  const id = parsePositiveInt64RouteId(order.id);
  const returnTo = `/orders${view === "seller" ? "?view=seller" : ""}`;
  return {
    id: `${view}-${order.id}`,
    orderNo: order.orderNo || null,
    type: "spot",
    view,
    title: order.productTitle,
    store: order.store?.name ?? null,
    status: order.status,
    amount: order.totalAmountCents,
    summary: `现货 × ${order.quantity}`,
    imageUrls: order.productImageUrl ? [order.productImageUrl] : [],
    unitPriceCents: order.unitPriceCents,
    quantity: order.quantity,
    itemCount: 1,
    createdAt: order.createdAt,
    href: id
      ? `/orders/spot/${id}?view=${view}&returnTo=${encodeURIComponent(returnTo)}`
      : null,
    modifyHref: null,
    cancelDemandId: null,
    isExpired: false,
  };
}

function mapBuyerErrandOrder(
  order: BuyerErrandOrder,
  now: Date,
): RenderableOrder {
  const id = parsePositiveInt64RouteId(order.id);
  const editStoreId = parsePositiveInt64RouteId(order.storeId);
  return {
    id: `participant-${order.id}`,
    orderNo: null,
    type: "errand",
    view: "participant",
    title:
      order.productTemplates
        .slice(0, 3)
        .map((template) => template.title)
        .join("、") ||
      order.store?.name ||
      "跑腿订单",
    store: order.store?.name ?? null,
    status: order.status,
    amount:
      (order.totalActualAmountCents ?? order.totalOriginAmountCents) +
      order.totalServiceFeeCents,
    summary: `${order.productTotalCount} 种商品 · 跑腿费 ${formatPrice(order.totalServiceFeeCents)}`,
    imageUrls: order.productTemplates
      .map((template) => template.mainImageUrl)
      .filter(Boolean),
    unitPriceCents: null,
    quantity: null,
    itemCount: order.productTotalCount,
    createdAt: order.createdAt,
    href: id ? `/orders/errand/${id}` : null,
    modifyHref:
      id && editStoreId && order.status === "open"
        ? `/group/shop/${editStoreId}?editDemandId=${id}`
        : null,
    cancelDemandId: id && order.status === "open" ? id : null,
    isExpired: false,
  };
}

function mapErrandTask(task: ErrandTaskBrief): RenderableOrder {
  const id = parsePositiveInt64RouteId(task.id);
  return {
    id: `captain-${task.id}`,
    orderNo: null,
    type: "errand",
    view: "captain",
    title: task.storeName,
    store: null,
    status: task.status,
    amount: null,
    summary: `${task.itemCount} 种商品`,
    imageUrls: [],
    unitPriceCents: null,
    quantity: null,
    itemCount: task.itemCount,
    createdAt: task.createdAt,
    href: id ? `/group/purchase/${id}` : null,
    modifyHref: null,
    cancelDemandId: null,
    isExpired: false,
  };
}

function filterOrders(
  orders: RenderableOrder[],
  filters: OrderFilters,
): RenderableOrder[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return orders.filter(
    (order) =>
      order.type === filters.type &&
      order.view === filters.view &&
      matchesOrderStatus(filters.status, order.status) &&
      (!query ||
        order.title.toLocaleLowerCase("zh-CN").includes(query) ||
        order.store?.toLocaleLowerCase("zh-CN").includes(query) ||
        order.orderNo?.toLocaleLowerCase("zh-CN").includes(query)),
  );
}

function rememberView(
  remembered: RememberedOrderViews,
  filters: Pick<OrderFilters, "type" | "view">,
): RememberedOrderViews {
  if (
    filters.type === "spot" &&
    (filters.view === "buyer" || filters.view === "seller")
  ) {
    return { ...remembered, spot: filters.view };
  }
  if (
    filters.type === "errand" &&
    (filters.view === "participant" || filters.view === "captain")
  ) {
    return { ...remembered, errand: filters.view };
  }
  return remembered;
}

function getCurrentError(
  filters: OrderFilters,
  errors: OrdersViewProps["errors"],
): boolean {
  if (filters.type === "spot" && filters.view === "seller")
    return errors.spotSeller;
  if (filters.type === "errand" && filters.view === "participant") {
    return errors.errandParticipant;
  }
  if (filters.type === "errand" && filters.view === "captain") {
    return errors.errandCaptain;
  }
  return errors.spotBuyer;
}
