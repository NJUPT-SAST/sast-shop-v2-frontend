"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { RiFileList3Line, RiSearchLine } from "@remixicon/react";
import { BrandIllustration } from "./brand-illustration";
import {
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
import Link from "next/link";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toast } from "sonner";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";

import { getBuyerErrandOrderAmountCents } from "@/lib/buyer-errand-order-detail";
import { buildBuyerErrandOrderDetailHref } from "@/lib/buyer-errand-order-route";
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
import { buildSpotOrderDetailHref } from "@/lib/spot-order-route";
import { ManagedImage } from "./managed-image";

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
};

const orderDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
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
  const [filters, setFilters] = useState<OrderFilters>(initialFilters);
  const [rememberedViews, setRememberedViews] = useState<RememberedOrderViews>(
    () =>
      rememberOrderView(
        DEFAULT_REMEMBERED_ORDER_VIEWS,
        initialFilters.type,
        initialFilters.view,
      ),
  );
  const statusScrollRef = useRef<HTMLDivElement | null>(null);
  const searchRouteTimerRef = useRef<number | null>(null);
  const pendingSearchHrefRef = useRef<string | null>(null);
  const [statusScrollState, setStatusScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
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
  const statusOptions = getStatusOptions(filters.type, filters.view);
  const viewOptions = getViewOptions(filters.type);
  const orders = useMemo<RenderableOrder[]>(
    () => [
      ...spotBuyerFeed.items.map((order) => mapSpotOrder(order, "buyer")),
      ...spotSellerFeed.items.map((order) => mapSpotOrder(order, "seller")),
      ...buyerErrandFeed.items.map(mapBuyerErrandOrder),
      ...errandTaskFeed.items.map(mapErrandTaskBrief),
    ],
    [
      buyerErrandFeed.items,
      errandTaskFeed.items,
      spotBuyerFeed.items,
      spotSellerFeed.items,
    ],
  );
  const filteredOrders = useMemo(
    () => filterOrders(orders, filters),
    [filters, orders],
  );
  const currentError = getCurrentError(filters, errors);
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
  const updateStatusScrollState = useCallback(() => {
    const element = statusScrollRef.current;
    if (!element) return;
    setStatusScrollState({
      canScrollLeft: element.scrollLeft > 1,
      canScrollRight:
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const syncFiltersFromLocation = () => {
      if (searchRouteTimerRef.current !== null) {
        window.clearTimeout(searchRouteTimerRef.current);
        searchRouteTimerRef.current = null;
      }
      pendingSearchHrefRef.current = null;
      const nextFilters = getOrderFiltersFromParams(
        new URLSearchParams(window.location.search),
      );

      setFilters(nextFilters);
      setRememberedViews((current) =>
        rememberOrderView(current, nextFilters.type, nextFilters.view),
      );
    };

    syncFiltersFromLocation();
    window.addEventListener("popstate", syncFiltersFromLocation);

    return () => {
      if (searchRouteTimerRef.current !== null) {
        window.clearTimeout(searchRouteTimerRef.current);
      }
      pendingSearchHrefRef.current = null;
      window.removeEventListener("popstate", syncFiltersFromLocation);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateStatusScrollState);
    window.addEventListener("resize", updateStatusScrollState);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateStatusScrollState);
    };
  }, [filters.type, filters.view, updateStatusScrollState]);

  useEffect(() => {
    const shouldContinueSearching = filters.query.trim().length > 0;
    const shouldFillEmptyFilter = filteredOrders.length === 0;

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
    filteredOrders.length,
    filters.query,
    loadMoreCurrentFeed,
  ]);

  function updateFilters(updates: {
    type?: OrderType;
    view?: OrderView;
    status?: OrderStatus;
    q?: string;
  }) {
    const nextRememberedViews = updates.view
      ? rememberOrderView(rememberedViews, filters.type, updates.view)
      : rememberedViews;
    const currentParams = updateOrderFilterParams(
      new URLSearchParams(window.location.search),
      {
        type: filters.type,
        view: filters.view,
        status: filters.status,
        q: filters.query,
        rememberedViews,
      },
    );
    const nextParams = updateOrderFilterParams(currentParams, {
      ...updates,
      rememberedViews: nextRememberedViews,
    });
    const nextFilters = getOrderFiltersFromParams(nextParams);

    setFilters(nextFilters);
    if (nextRememberedViews !== rememberedViews) {
      setRememberedViews(nextRememberedViews);
    }

    const nextHref = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;
    const onlySearchChanged =
      updates.q !== undefined &&
      updates.type === undefined &&
      updates.view === undefined &&
      updates.status === undefined;

    if (searchRouteTimerRef.current !== null) {
      window.clearTimeout(searchRouteTimerRef.current);
      searchRouteTimerRef.current = null;
    }

    if (onlySearchChanged) {
      pendingSearchHrefRef.current = nextHref;
      searchRouteTimerRef.current = window.setTimeout(() => {
        flushPendingSearchRoute();
      }, 250);
    } else {
      pendingSearchHrefRef.current = null;
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }

  function flushPendingSearchRoute() {
    if (searchRouteTimerRef.current !== null) {
      window.clearTimeout(searchRouteTimerRef.current);
      searchRouteTimerRef.current = null;
    }

    const pendingHref = pendingSearchHrefRef.current;
    pendingSearchHrefRef.current = null;
    if (pendingHref) {
      window.history.replaceState(window.history.state, "", pendingHref);
    }
  }

  function cancelPendingSearchRoute() {
    if (searchRouteTimerRef.current !== null) {
      window.clearTimeout(searchRouteTimerRef.current);
      searchRouteTimerRef.current = null;
    }
    pendingSearchHrefRef.current = null;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 py-4">
      <section>
        <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
      </section>

      <section aria-label="订单筛选" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Tabs
            value={filters.type}
            onValueChange={(value) =>
              updateFilters({ type: value as OrderType })
            }
          >
            <TabsList
              aria-label="订单类型"
              variant="line"
              className="h-11 gap-1 p-0"
            >
              {orderTypeOptions.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="h-11 min-w-16 px-3"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select
            value={filters.view}
            onValueChange={(value) =>
              updateFilters({ view: value as OrderView })
            }
          >
            <SelectTrigger
              aria-label="订单视角"
              className="h-11 w-fit shrink-0 gap-2 border-transparent bg-transparent shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {viewOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="min-h-11"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <InputGroup className="h-11 bg-card">
          <InputGroupAddon>
            <InputGroupText>
              <RiSearchLine />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="搜索店铺或商品"
            value={filters.query}
            onChange={(event) => updateFilters({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") flushPendingSearchRoute();
            }}
            placeholder="搜索店铺或商品"
          />
        </InputGroup>

        <div className="flex min-w-0 items-center gap-2 pb-1">
          <Button
            type="button"
            variant={filters.status === "all" ? "default" : "outline"}
            size="sm"
            className="h-8 shrink-0 rounded-full px-3 text-xs"
            aria-pressed={filters.status === "all"}
            onClick={() => updateFilters({ status: "all" })}
          >
            全部
          </Button>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {statusScrollState.canScrollLeft ? (
              <span className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent" />
            ) : null}
            <div
              ref={statusScrollRef}
              className="min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain app-scrollbar"
              onScroll={updateStatusScrollState}
            >
              <ToggleGroup
                type="single"
                value={filters.status === "all" ? "" : filters.status}
                variant="outline"
                size="sm"
                spacing={1}
                selectionVariant="primary"
                aria-label="订单状态筛选"
                className="w-max flex-nowrap"
                onValueChange={(value) => {
                  if (value) updateFilters({ status: value as OrderStatus });
                }}
              >
                {statusOptions.slice(1).map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={`筛选${option.label}订单`}
                    className="h-8 min-w-0 rounded-full px-3 text-xs"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            {statusScrollState.canScrollRight ? (
              <span className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent" />
            ) : null}
          </div>
        </div>
      </section>

      <div
        className="min-w-0"
        onClickCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          ) {
            cancelPendingSearchRoute();
          }
        }}
      >
        <OrderList
          filters={filters}
          orders={filteredOrders}
          hasError={currentError}
          showEmpty={!currentFeed.loadingMore && !currentFeed.hasMore}
          onRetry={() => router.refresh()}
        />
        {!currentError ? (
          <InfiniteListStatus
            hasMore={currentFeed.hasMore}
            loading={currentFeed.loadingMore}
            error={currentFeed.loadMoreError}
            hasItems={filteredOrders.length > 0}
            onLoadMore={() => void currentFeed.loadMore()}
            loadingFallback={<OrderLoadingSkeletons />}
            endMessage={`已经到底，共 ${filteredOrders.length} 笔订单`}
            endMessageClassName="pt-6"
          />
        ) : null}
      </div>
    </div>
  );
}

function OrderList({
  filters,
  orders,
  hasError,
  showEmpty,
  onRetry,
}: {
  filters: OrderFilters;
  orders: RenderableOrder[];
  hasError: boolean;
  showEmpty: boolean;
  onRetry: () => void;
}) {
  if (hasError) {
    return (
      <LoadFailure
        title="订单加载失败"
        description="网络或服务暂时不可用，请稍后重试。"
        onRetry={onRetry}
      />
    );
  }

  if (orders.length === 0 && showEmpty) {
    return (
      <Empty
        icon={
          filters.query.trim() ? (
            <RiFileList3Line className="size-5" />
          ) : undefined
        }
        illustration={
          !filters.query.trim() ? (
            <BrandIllustration name="orders" size={96} />
          ) : undefined
        }
        title={getEmptyTitle(filters)}
      />
    );
  }

  if (orders.length === 0) return null;

  return (
    <section
      aria-label="订单列表"
      className="grid min-w-0 gap-3 md:grid-cols-2"
    >
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </section>
  );
}

function OrderLoadingSkeletons() {
  return (
    <div
      className="grid min-w-0 gap-3 md:grid-cols-2"
      role="status"
      aria-label="正在加载更多订单"
    >
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardHeader className="gap-2 pb-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/5" />
          </CardHeader>
          <CardContent className="flex items-center gap-3 pb-3">
            <Skeleton className="size-16 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </CardContent>
          <div className="flex justify-between border-t bg-muted/30 px-4 py-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-5 w-20" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function getOrderKey(order: { id: string }) {
  return order.id;
}

function OrderCard({ order }: { order: RenderableOrder }) {
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!navigating) return;

    const timeout = window.setTimeout(() => {
      setNavigating(false);
      toast.error("订单详情打开失败，请重试");
    }, 10_000);

    return () => window.clearTimeout(timeout);
  }, [navigating]);

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (navigating) {
      event.preventDefault();
      return;
    }

    setNavigating(true);
  }

  const card = (
    <Card
      aria-busy={navigating}
      className="relative min-w-0 overflow-hidden rounded-lg transition-colors group-hover:border-primary/40"
    >
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 min-w-0 flex-1 text-base leading-6">
            {order.title}
          </CardTitle>
          <Badge
            variant={getStatusBadgeVariant(order.status)}
            className="shrink-0"
          >
            {getStatusLabel(order.status, order.view)}
          </Badge>
        </div>
        {order.store || order.orderNo ? (
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {order.store}
            {order.store && order.orderNo ? (
              <span aria-hidden="true"> · </span>
            ) : null}
            {order.orderNo ? (
              <span className="font-mono text-xs tabular-nums">
                {order.orderNo}
              </span>
            ) : null}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-w-0 items-center gap-3 pb-3">
        <OrderThumbnails order={order} />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          {order.unitPriceCents !== null ? (
            <p className="font-medium tabular-nums">
              {formatPrice(order.unitPriceCents)}
              {order.quantity !== null ? ` × ${order.quantity}` : null}
            </p>
          ) : null}
          {order.itemCount > 1 ? (
            <p className="text-muted-foreground">共 {order.itemCount} 种商品</p>
          ) : null}
          {formatOrderDate(order.createdAt) ? (
            <p className="text-xs text-muted-foreground">
              创建于 {formatOrderDate(order.createdAt)}
            </p>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="min-w-0 justify-between gap-3 border-t bg-muted/30 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {order.summary}
        </p>
        {order.amount !== null ? (
          <div className="flex shrink-0 items-baseline gap-1 text-right">
            <span className="text-xs text-muted-foreground">合计</span>
            <span className="text-lg font-semibold tabular-nums text-primary">
              {formatPrice(order.amount)}
            </span>
          </div>
        ) : null}
      </CardFooter>
      {navigating ? (
        <span className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-[1px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
          <Spinner className="size-5" />
          <span className="sr-only">正在打开订单详情</span>
        </span>
      ) : null}
    </Card>
  );

  if (!order.href) return card;

  return (
    <Link
      href={order.href}
      aria-disabled={navigating}
      onClick={handleNavigation}
      className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
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
        className="size-16 shrink-0 rounded-lg"
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
          className="size-14 rounded-lg border-2 border-card"
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

function getEmptyTitle(filters: OrderFilters): string {
  if (filters.type === "spot" && filters.view === "seller") {
    return "暂无现货卖方订单";
  }

  if (filters.type === "errand" && filters.view === "participant") {
    return "暂无跑腿拼单订单";
  }

  if (filters.type === "errand" && filters.view === "captain") {
    return "暂无团长任务";
  }

  return "暂无现货买方订单";
}

function getCurrentError(
  filters: OrderFilters,
  errors: OrdersViewProps["errors"],
): boolean {
  if (filters.type === "spot" && filters.view === "seller") {
    return errors.spotSeller;
  }

  if (filters.type === "errand" && filters.view === "participant") {
    return errors.errandParticipant;
  }

  if (filters.type === "errand" && filters.view === "captain") {
    return errors.errandCaptain;
  }

  return errors.spotBuyer;
}

function mapSpotOrder(
  order: SpotOrder,
  view: "buyer" | "seller",
): RenderableOrder {
  return {
    id: `${view}-${order.id}`,
    orderNo: order.orderNo || null,
    type: "spot",
    view,
    title: order.productTitle,
    store: order.store?.name ?? null,
    status: order.status,
    amount: order.totalAmountCents,
    summary: `${order.quantity} 件商品`,
    imageUrls: order.productImageUrl ? [order.productImageUrl] : [],
    unitPriceCents: order.unitPriceCents,
    quantity: order.quantity,
    itemCount: 1,
    createdAt: order.createdAt,
    href: buildSpotOrderDetailHref(order.id, view),
  };
}

function mapBuyerErrandOrder(order: BuyerErrandOrder): RenderableOrder {
  const amount = getBuyerErrandOrderAmountCents({ ...order, bill: null });

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
    amount,
    summary: `${order.productTotalCount} 种商品`,
    imageUrls: order.productTemplates
      .map((template) => template.mainImageUrl)
      .filter(Boolean),
    unitPriceCents: null,
    quantity: null,
    itemCount: order.productTotalCount,
    createdAt: order.createdAt,
    href: buildBuyerErrandOrderDetailHref(order.id),
  };
}

function mapErrandTaskBrief(task: ErrandTaskBrief): RenderableOrder {
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
    href: `/group/purchase/${task.id}`,
  };
}

function filterOrders(
  orders: RenderableOrder[],
  filters: OrderFilters,
): RenderableOrder[] {
  const query = filters.query.trim().toLowerCase();

  return orders.filter(
    (order) =>
      order.type === filters.type &&
      order.view === filters.view &&
      matchesRenderableStatus(filters, order.status) &&
      (!query ||
        order.store?.toLowerCase().includes(query) ||
        order.title.toLowerCase().includes(query)),
  );
}

function matchesRenderableStatus(
  filters: OrderFilters,
  status: RenderableOrderStatus,
): boolean {
  return matchesOrderStatus(filters.status, status);
}

function rememberOrderView(
  rememberedViews: RememberedOrderViews,
  type: OrderType,
  view: OrderView,
): RememberedOrderViews {
  if (type === "spot" && (view === "buyer" || view === "seller")) {
    return { ...rememberedViews, spot: view };
  }

  if (type === "errand" && (view === "participant" || view === "captain")) {
    return { ...rememberedViews, errand: view };
  }

  return rememberedViews;
}
