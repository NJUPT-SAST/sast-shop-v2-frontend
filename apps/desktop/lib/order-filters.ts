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
export type OrderFilters = {
  type: OrderType;
  view: OrderView;
  status: OrderStatus;
  query: string;
};
export type OrderOption<T extends string> = { value: T; label: string };

export const DEFAULT_REMEMBERED_ORDER_VIEWS: RememberedOrderViews = {
  spot: "buyer",
  errand: "participant",
};

const DEFAULT_FILTERS: OrderFilters = {
  type: "spot",
  view: "buyer",
  status: "all",
  query: "",
};

export const orderTypeOptions: OrderOption<OrderType>[] = [
  { value: "spot", label: "现货" },
  { value: "errand", label: "跑腿" },
];

const spotViews: OrderOption<SpotOrderView>[] = [
  { value: "buyer", label: "我购买的" },
  { value: "seller", label: "我售出的" },
];

const errandViews: OrderOption<ErrandOrderView>[] = [
  { value: "participant", label: "我的拼单" },
  { value: "captain", label: "团长任务" },
];

const spotBuyerStatuses: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const spotSellerStatuses: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待收款" },
  { value: "processing", label: "后续处理" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const errandParticipantStatuses: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "open", label: "未接单" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "pending_payment", label: "待支付" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const errandCaptainStatuses: OrderOption<OrderStatus>[] = [
  { value: "all", label: "全部" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "collecting_payment", label: "收款中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const allStatusOptions = [
  ...spotBuyerStatuses,
  ...spotSellerStatuses,
  ...errandParticipantStatuses,
  ...errandCaptainStatuses,
];

export function getViewOptions(type: OrderType): OrderOption<OrderView>[] {
  return type === "spot" ? spotViews : errandViews;
}

export function getStatusOptions(
  type: OrderType,
  view: OrderView,
): OrderOption<OrderStatus>[] {
  if (type === "spot" && view === "seller") return spotSellerStatuses;
  if (type === "errand" && view === "captain") return errandCaptainStatuses;
  if (type === "errand") return errandParticipantStatuses;
  return spotBuyerStatuses;
}

export function getOrderFiltersFromParams(
  params: URLSearchParams,
): OrderFilters {
  const type: OrderType = params.get("type") === "errand" ? "errand" : "spot";
  const requestedView = params.get("view");
  const defaultView = DEFAULT_REMEMBERED_ORDER_VIEWS[type];
  const view = getViewOptions(type).some(
    (option) => option.value === requestedView,
  )
    ? (requestedView as OrderView)
    : defaultView;
  const requestedStatus = params.get("status");
  const status = getStatusOptions(type, view).some(
    (option) => option.value === requestedStatus,
  )
    ? (requestedStatus as OrderStatus)
    : "all";

  return {
    type,
    view,
    status,
    query: params.get("q") ?? "",
  };
}

export function updateOrderFilterParams(
  current: URLSearchParams,
  updates: {
    type?: OrderType;
    view?: OrderView;
    status?: OrderStatus;
    q?: string;
    rememberedViews: RememberedOrderViews;
  },
): URLSearchParams {
  const currentFilters = getOrderFiltersFromParams(current);
  const type = updates.type ?? currentFilters.type;
  const typeChanged = type !== currentFilters.type;
  const requestedView =
    updates.view ??
    (typeChanged ? updates.rememberedViews[type] : currentFilters.view);
  const view = getViewOptions(type).some(
    (option) => option.value === requestedView,
  )
    ? requestedView
    : DEFAULT_REMEMBERED_ORDER_VIEWS[type];
  const viewChanged = view !== currentFilters.view;
  const requestedStatus =
    typeChanged || viewChanged
      ? "all"
      : (updates.status ?? currentFilters.status);
  const status = getStatusOptions(type, view).some(
    (option) => option.value === requestedStatus,
  )
    ? requestedStatus
    : "all";
  const query =
    typeChanged || viewChanged ? "" : (updates.q ?? currentFilters.query);
  const params = new URLSearchParams(current);

  setParam(params, "type", type, DEFAULT_FILTERS.type);
  setParam(params, "view", view, DEFAULT_REMEMBERED_ORDER_VIEWS[type]);
  setParam(params, "status", status, "all");
  setParam(params, "q", query, "");
  params.delete("page");

  return params;
}

export function getStatusLabel(
  status: RenderableOrderStatus,
  view?: OrderView,
): string {
  if (view === "seller" && status === "pending_payment") return "待收款";
  if (view === "seller" && (status === "paid" || status === "processing"))
    return "后续处理";
  if (status === "paid") return "处理中";

  return (
    allStatusOptions.find((option) => option.value === status)?.label ??
    "状态异常"
  );
}

export function getStatusBadgeVariant(
  status: RenderableOrderStatus,
): NonNullable<BadgeProps["variant"]> {
  if (status === "shopping") return "warning";
  if (status === "pending_distributing" || status === "distributing")
    return "info";
  if (status === "pending_payment") return "payment";
  if (status === "collecting_payment") {
    return "attention";
  }
  if (status === "paid") return "review";
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  return "neutral";
}

export function matchesOrderStatus(
  filter: OrderStatus,
  status: RenderableOrderStatus,
): boolean {
  if (filter === "all") return true;
  if (filter === "processing")
    return status === "paid" || status === "processing";
  return filter === status;
}

function setParam(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
) {
  if (value && value !== defaultValue) params.set(key, value);
  else params.delete(key);
}
