"use client";

import { useEffect, useMemo, useState } from "react";
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

type RenderableOrder = {
  id: string;
  orderNo: string;
  type: OrderType;
  view: OrderView;
  title: string;
  store: string;
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

  useEffect(() => {
    const syncFiltersFromLocation = () => {
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
      window.removeEventListener("popstate", syncFiltersFromLocation);
    };
  }, []);

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

    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname,
      { scroll: false },
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 py-6">
      <section>
        <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
      </section>

      <section aria-label="订单筛选" className="flex min-w-0 flex-col gap-3">
        <Tabs
          value={filters.type}
          onValueChange={(value) => updateFilters({ type: value as OrderType })}
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

        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">我的角色</span>
          <ToggleGroup
            type="single"
            value={filters.view}
            variant="outline"
            size="touch"
            spacing={0}
            selectionVariant="primary"
            aria-label="订单查看身份"
            onValueChange={(value) => {
              if (value) updateFilters({ view: value as OrderView });
            }}
          >
            {viewOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
            placeholder="搜索店铺或商品"
          />
        </InputGroup>

        <div className="min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain pb-1">
          <ToggleGroup
            type="single"
            value={filters.status}
            variant="outline"
            size="touch"
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
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </section>

      <OrderList
        filters={filters}
        orders={filteredOrders}
        hasError={currentError}
      />
    </div>
  );
}

function OrderList({
  filters,
  orders,
  hasError,
}: {
  filters: OrderFilters;
  orders: RenderableOrder[];
  hasError: boolean;
}) {
  if (hasError) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title="订单暂不可用"
        description="当前订单列表加载失败，请稍后重试。"
      />
    );
  }

  if (orders.length === 0) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title={getEmptyTitle(filters)}
        description="换一个状态或清空搜索条件。"
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
  const card = (
    <Card className="min-w-0 overflow-hidden rounded-lg transition-colors group-hover:border-primary/40">
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
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          {order.store}
          <span aria-hidden="true"> · </span>
          <span className="font-mono text-xs">#{order.orderNo}</span>
        </p>
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
    </Card>
  );

  if (!order.href) return card;

  return (
    <Link
      href={order.href}
      prefetch={false}
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
    orderNo: order.orderNo || order.id,
    type: "spot",
    view,
    title: order.productTitle,
    store: order.store?.name ?? "现货",
    status: normalizeSpotStatus(order.status, view),
    amount: order.totalAmountCents,
    summary: `${order.quantity} 件商品`,
    href: buildSpotOrderDetailHref(order.id, view),
  };
}

function mapBuyerErrandOrder(order: BuyerErrandOrder): RenderableOrder {
  const amount = getBuyerErrandOrderAmountCents({ ...order, bill: null });

  return {
    id: `participant-${order.id}`,
    orderNo: order.id,
    type: "errand",
    view: "participant",
    title:
      order.productTemplates
        .slice(0, 3)
        .map((template) => template.title)
        .join("、") || "跑腿需求",
    store: order.store?.name ?? "跑腿店铺",
    status: order.status,
    amount,
    summary: `${order.productTotalCount} 种商品`,
    href: buildBuyerErrandOrderDetailHref(order.id),
  };
}

function mapErrandTaskBrief(task: ErrandTaskBrief): RenderableOrder {
  return {
    id: `captain-${task.id}`,
    orderNo: task.id,
    type: "errand",
    view: "captain",
    title: task.storeName,
    store: "采购任务",
    status: task.status,
    amount: null,
    summary: `${task.itemCount} 种商品`,
    href: `/group/purchase/${task.id}`,
  };
}

function normalizeSpotStatus(
  status: SpotOrder["status"],
  view: "buyer" | "seller",
): RenderableOrderStatus {
  if (view === "seller" && status === "pending_payment") {
    return "pending_confirm";
  }

  if (status === "paid") {
    return view === "seller" ? "paid" : "processing";
  }

  return status;
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
        order.store.toLowerCase().includes(query) ||
        order.title.toLowerCase().includes(query)),
  );
}

function matchesRenderableStatus(
  filters: OrderFilters,
  status: RenderableOrderStatus,
): boolean {
  if (
    filters.type === "spot" &&
    filters.view === "seller" &&
    filters.status === "processing"
  ) {
    return status === "processing";
  }

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
