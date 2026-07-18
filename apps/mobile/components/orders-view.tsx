"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { RiFileList3Line, RiSearchLine } from "@remixicon/react";
import type {
  BuyerErrandOrder,
  ErrandTaskBrief,
  SpotOrder,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import Link from "next/link";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";

import { getBuyerErrandOrderAmountCents } from "@/lib/buyer-errand-order-detail";
import { buildBuyerErrandOrderDetailHref } from "@/lib/buyer-errand-order-route";
import {
  DEFAULT_REMEMBERED_ORDER_VIEWS,
  getOrderFiltersFromParams,
  getCompactStatusLabel,
  getCompactViewLabel,
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
import { resolveTabSwipe } from "@/lib/tab-swipe";
import { MobileFloatingAction } from "./mobile-floating-action";

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
  href: string | null;
};

type OrdersViewProps = {
  initialFilters: OrderFilters;
  spotBuyerOrders: SpotOrder[];
  spotSellerOrders: SpotOrder[];
  buyerErrandOrders: BuyerErrandOrder[];
  errandTasks: ErrandTaskBrief[];
  errors: {
    spotBuyer: boolean;
    spotSeller: boolean;
    errandParticipant: boolean;
    errandCaptain: boolean;
  };
};

export function OrdersView({
  initialFilters,
  spotBuyerOrders,
  spotSellerOrders,
  buyerErrandOrders,
  errandTasks,
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
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const searchRouteTimerRef = useRef<number | null>(null);
  const pendingSearchHrefRef = useRef<string | null>(null);
  const [listTransition, setListTransition] = useState({
    key: 0,
    direction: "next" as "previous" | "next",
  });
  const statusOptions = getStatusOptions(filters.type, filters.view);
  const viewOptions = getViewOptions(filters.type);
  const orders = useMemo<RenderableOrder[]>(
    () => [
      ...spotBuyerOrders.map((order) => mapSpotOrder(order, "buyer")),
      ...spotSellerOrders.map((order) => mapSpotOrder(order, "seller")),
      ...buyerErrandOrders.map(mapBuyerErrandOrder),
      ...errandTasks.map(mapErrandTaskBrief),
    ],
    [buyerErrandOrders, errandTasks, spotBuyerOrders, spotSellerOrders],
  );
  const filteredOrders = useMemo(
    () => filterOrders(orders, filters),
    [filters, orders],
  );
  const currentError = getCurrentError(filters, errors);
  const currentViewIndex = viewOptions.findIndex(
    (option) => option.value === filters.view,
  );
  const nextViewOption =
    viewOptions[(currentViewIndex + 1) % viewOptions.length] ?? viewOptions[0];

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

  function updateFilters(
    updates: {
      type?: OrderType;
      view?: OrderView;
      status?: OrderStatus;
      q?: string;
    },
    transitionDirection?: "previous" | "next",
  ) {
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

    if (
      transitionDirection &&
      (nextFilters.type !== filters.type || nextFilters.view !== filters.view)
    ) {
      setListTransition((current) => ({
        key: current.key + 1,
        direction: transitionDirection,
      }));
    }

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
      router.replace(nextHref, { scroll: false });
    }
  }

  function flushPendingSearchRoute() {
    if (searchRouteTimerRef.current !== null) {
      window.clearTimeout(searchRouteTimerRef.current);
      searchRouteTimerRef.current = null;
    }

    const pendingHref = pendingSearchHrefRef.current;
    pendingSearchHrefRef.current = null;
    if (pendingHref) router.replace(pendingHref, { scroll: false });
  }

  function cancelPendingSearchRoute() {
    if (searchRouteTimerRef.current !== null) {
      window.clearTimeout(searchRouteTimerRef.current);
      searchRouteTimerRef.current = null;
    }
    pendingSearchHrefRef.current = null;
  }

  function handleSwipeStart(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) {
      swipeStartRef.current = null;
      return;
    }

    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function handleSwipeEnd(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;

    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const direction = resolveTabSwipe(start, {
      x: event.clientX,
      y: event.clientY,
    });
    if (!direction) return;

    lastSwipeAtRef.current = window.performance.now();

    const currentIndex = orderTypeOptions.findIndex(
      (option) => option.value === filters.type,
    );
    const nextIndex = currentIndex + (direction === "next" ? 1 : -1);
    const nextType = orderTypeOptions[nextIndex]?.value;
    if (nextType) updateFilters({ type: nextType }, direction);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 py-6">
      <section>
        <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
      </section>

      <section aria-label="订单筛选" className="flex min-w-0 flex-col gap-3">
        <Tabs
          value={filters.type}
          onValueChange={(value) => {
            const nextType = value as OrderType;
            const currentIndex = orderTypeOptions.findIndex(
              (option) => option.value === filters.type,
            );
            const nextIndex = orderTypeOptions.findIndex(
              (option) => option.value === nextType,
            );
            updateFilters(
              { type: nextType },
              nextIndex > currentIndex ? "next" : "previous",
            );
          }}
          className="flex-col"
        >
          <TabsList className="grid h-11 w-full grid-cols-2 md:w-fit">
            {orderTypeOptions.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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

        <div className="min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain pb-1">
          <ToggleGroup
            type="single"
            value={filters.status}
            variant="outline"
            spacing={1}
            selectionVariant="primary"
            aria-label="订单状态筛选"
            className="w-max flex-nowrap"
            onValueChange={(value) => {
              if (value) updateFilters({ status: value as OrderStatus });
            }}
          >
            {statusOptions.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={`筛选${option.label}订单`}
                className="h-11 min-w-11 px-2 text-xs"
              >
                {getCompactStatusLabel(option.value)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </section>

      <div
        key={listTransition.key}
        className={`min-w-0 touch-pan-y pb-14 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 ${
          listTransition.direction === "next"
            ? "motion-safe:slide-in-from-right-3"
            : "motion-safe:slide-in-from-left-3"
        }`}
        onPointerDown={handleSwipeStart}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
        onClickCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          ) {
            cancelPendingSearchRoute();
          }

          if (window.performance.now() - lastSwipeAtRef.current <= 250) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <OrderList
          filters={filters}
          orders={filteredOrders}
          hasError={currentError}
          onRetry={() => router.refresh()}
        />
      </div>

      {nextViewOption ? (
        <MobileFloatingAction
          type="button"
          variant="outline"
          className="bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 flex-col gap-0 overflow-hidden border-border bg-card p-0 text-sm font-semibold text-foreground"
          aria-label={`切换到${nextViewOption.label}`}
          title={`当前：${viewOptions[currentViewIndex]?.label ?? "订单视角"}`}
          onClick={() => {
            updateFilters({ view: nextViewOption.value }, "next");
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-primary transition-[clip-path] duration-200 ease-out motion-reduce:transition-none"
            style={{
              clipPath:
                currentViewIndex === 1
                  ? "polygon(100% 0, 100% 100%, 0 100%)"
                  : "polygon(0 0, 100% 0, 0 100%)",
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-10 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-border/70"
          />
          {viewOptions.map((option, index) => (
            <span
              key={option.value}
              className={`absolute z-20 transition-colors duration-200 motion-reduce:transition-none ${
                index === 0 ? "top-2.5 left-3" : "right-3 bottom-2.5"
              } ${
                index === currentViewIndex
                  ? "text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {getCompactViewLabel(option.value)}
            </span>
          ))}
        </MobileFloatingAction>
      ) : null}
    </div>
  );
}

function OrderList({
  filters,
  orders,
  hasError,
  onRetry,
}: {
  filters: OrderFilters;
  orders: RenderableOrder[];
  hasError: boolean;
  onRetry: () => void;
}) {
  if (hasError) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title="订单暂不可用"
        action={
          <Button type="button" variant="outline" onClick={onRetry}>
            重新加载
          </Button>
        }
      />
    );
  }

  if (orders.length === 0) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title={getEmptyTitle(filters)}
      />
    );
  }

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
            {getStatusLabel(order.status)}
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
