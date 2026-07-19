import type {
  BuyerErrandOrderStatus,
  ErrandTaskStatusValue,
  SpotOrderStatusValue,
} from "@sast-shop/api";
import type { BadgeProps } from "@workspace/ui/components/badge";

export type OrderType = "spot" | "errand";
export type SpotOrderView = "buyer" | "seller";
export type ErrandOrderView = "participant" | "captain";
export type OrderView = SpotOrderView | ErrandOrderView;
export type OrderViewForType<T extends OrderType> = T extends "spot"
  ? SpotOrderView
  : ErrandOrderView;
export type OrderStatus =
  | "all"
  | "processing"
  | BuyerErrandOrderStatus
  | ErrandTaskStatusValue
  | SpotOrderStatusValue;
export type RenderableOrderStatus = Exclude<OrderStatus, "all">;
export type RememberedOrderViews = {
  spot: SpotOrderView;
  errand: ErrandOrderView;
};
export type SpotOrderFilters = {
  type: "spot";
  view: SpotOrderView;
  status: OrderStatus;
  query: string;
};
export type ErrandOrderFilters = {
  type: "errand";
  view: ErrandOrderView;
  status: OrderStatus;
  query: string;
};
export type OrderFilters = SpotOrderFilters | ErrandOrderFilters;
export type OrderOption<T extends string> = { value: T; label: string };

export const DEFAULT_REMEMBERED_ORDER_VIEWS: RememberedOrderViews = {
  spot: "buyer",
  errand: "participant",
};

export const DEFAULT_ORDER_FILTERS = {
  type: "spot",
  view: "buyer",
  status: "all",
  query: "",
} satisfies OrderFilters;

export const orderTypeOptions: OrderOption<OrderType>[] = [
  { value: "spot", label: "现货" },
  { value: "errand", label: "跑腿" },
];

const spotViewOptions: OrderOption<SpotOrderView>[] = [
  { value: "buyer", label: "我购买的" },
  { value: "seller", label: "我售出的" },
];

const errandViewOptions: OrderOption<ErrandOrderView>[] = [
  { value: "participant", label: "我的拼单" },
  { value: "captain", label: "团长任务" },
];

const spotBuyerStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const errandParticipantStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "open", label: "未接单" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "pending_payment", label: "待支付" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const errandCaptainStatusOptions: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "collecting_payment", label: "收款中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const statusOptionGroups = [
  spotBuyerStatusOptions,
  errandParticipantStatusOptions,
  errandCaptainStatusOptions,
];

export function getViewOptions(type: OrderType): OrderOption<OrderView>[] {
  return type === "spot" ? spotViewOptions : errandViewOptions;
}

export function getStatusOptions(
  type: OrderType,
  view: OrderView,
): OrderOption<OrderStatus>[] {
  if (type === "spot" && view === "seller") {
    return spotBuyerStatusOptions;
  }

  if (type === "errand" && view === "captain") {
    return errandCaptainStatusOptions;
  }

  if (type === "errand") {
    return errandParticipantStatusOptions;
  }

  return spotBuyerStatusOptions;
}

export function getDefaultViewForType(type: "spot"): SpotOrderView;
export function getDefaultViewForType(type: "errand"): ErrandOrderView;
export function getDefaultViewForType(type: OrderType): OrderView;
export function getDefaultViewForType(type: OrderType): OrderView {
  return DEFAULT_REMEMBERED_ORDER_VIEWS[type];
}

export function isOrderType(value: string | null): value is OrderType {
  return value === "spot" || value === "errand";
}

export function isOrderView(value: string | null): value is OrderView {
  return (
    value === "buyer" ||
    value === "seller" ||
    value === "participant" ||
    value === "captain"
  );
}

export function isViewForType(type: OrderType, view: OrderView): boolean {
  return getViewOptions(type).some((option) => option.value === view);
}

export function isStatusForView(
  type: OrderType,
  view: OrderView,
  status: string | null,
): status is OrderStatus {
  return getStatusOptions(type, view).some((option) => option.value === status);
}

export function matchesOrderStatus(
  filter: OrderStatus,
  status: RenderableOrderStatus,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "processing") {
    return status === "paid" || status === "processing";
  }

  return filter === status;
}

export function getOrderFiltersFromParams(
  params: URLSearchParams,
): OrderFilters {
  const typeParam = params.get("type");
  const viewParam = params.get("view");
  const statusParam = params.get("status");
  const type = isOrderType(typeParam) ? typeParam : DEFAULT_ORDER_FILTERS.type;
  const query = params.get("q") ?? "";

  if (type === "spot") {
    const view = isSpotOrderView(viewParam)
      ? viewParam
      : getDefaultViewForType(type);

    return {
      type,
      view,
      status: isStatusForView(type, view, statusParam) ? statusParam : "all",
      query,
    };
  }

  const view = isErrandOrderView(viewParam)
    ? viewParam
    : getDefaultViewForType(type);

  return {
    type,
    view,
    status: isStatusForView(type, view, statusParam) ? statusParam : "all",
    query,
  };
}

export function updateOrderFilterParams(
  currentParams: URLSearchParams,
  updates: {
    type?: OrderType;
    view?: OrderView;
    status?: OrderStatus;
    q?: string;
    rememberedViews: RememberedOrderViews;
  },
): URLSearchParams {
  const currentFilters = getOrderFiltersFromParams(currentParams);
  const nextType = updates.type ?? currentFilters.type;
  const typeChanged = nextType !== currentFilters.type;
  const nextView = getUpdatedView(currentFilters, nextType, updates);
  const viewChanged = nextView !== currentFilters.view;
  const shouldResetRefinements = typeChanged || viewChanged;
  const requestedStatus = shouldResetRefinements
    ? "all"
    : (updates.status ?? currentFilters.status);
  const nextStatus = isStatusForView(nextType, nextView, requestedStatus)
    ? requestedStatus
    : "all";
  const nextQuery = shouldResetRefinements
    ? ""
    : (updates.q ?? currentFilters.query);
  const nextParams = new URLSearchParams(currentParams);

  setQueryParam(nextParams, "type", nextType, DEFAULT_ORDER_FILTERS.type);
  setQueryParam(nextParams, "view", nextView, getDefaultViewForType(nextType));
  setQueryParam(nextParams, "status", nextStatus, "all");
  setQueryParam(nextParams, "q", nextQuery, "");

  return nextParams;
}

export function getStatusLabel(status: OrderStatus): string {
  if (status === "paid") return "处理中";

  for (const options of statusOptionGroups) {
    const option = options.find((item) => item.value === status);

    if (option) {
      return option.label;
    }
  }

  return "状态异常";
}

export function getCompactStatusLabel(status: OrderStatus): string {
  return getStatusLabel(status);
}

export function getCompactViewLabel(view: OrderView): string {
  if (view === "buyer") return "买";
  if (view === "seller") return "卖";
  if (view === "participant") return "拼";
  return "团";
}

export function getStatusBadgeVariant(
  status: OrderStatus,
): NonNullable<BadgeProps["variant"]> {
  if (status === "shopping") return "warning";
  if (status === "pending_distributing" || status === "distributing") {
    return "info";
  }
  if (status === "pending_payment") return "payment";
  if (status === "collecting_payment") {
    return "attention";
  }
  if (status === "paid") return "review";
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";

  return "neutral";
}

function isSpotOrderView(value: string | null): value is SpotOrderView {
  return value === "buyer" || value === "seller";
}

function isErrandOrderView(value: string | null): value is ErrandOrderView {
  return value === "participant" || value === "captain";
}

function getUpdatedView(
  currentFilters: OrderFilters,
  nextType: OrderType,
  updates: {
    view?: OrderView;
    rememberedViews: RememberedOrderViews;
  },
): OrderView {
  if (updates.view && isViewForType(nextType, updates.view)) {
    return updates.view;
  }

  if (nextType !== currentFilters.type) {
    const rememberedView = updates.rememberedViews[nextType];

    return isViewForType(nextType, rememberedView)
      ? rememberedView
      : getDefaultViewForType(nextType);
  }

  return isViewForType(nextType, currentFilters.view)
    ? currentFilters.view
    : getDefaultViewForType(nextType);
}

function setQueryParam(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
) {
  if (value && value !== defaultValue) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}
