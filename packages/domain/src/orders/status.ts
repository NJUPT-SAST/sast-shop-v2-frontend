export enum OrderStatus {
  PendingPayment = "pending_payment",
  PendingShipment = "pending_shipment",
  Shipped = "shipped",
  Completed = "completed",
  Cancelled = "cancelled"
}

export type StatusTone = "warning" | "info" | "success" | "muted";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    tone: StatusTone;
  }
> = {
  [OrderStatus.PendingPayment]: {
    label: "待付款",
    tone: "warning"
  },
  [OrderStatus.PendingShipment]: {
    label: "待发货",
    tone: "info"
  },
  [OrderStatus.Shipped]: {
    label: "已发货",
    tone: "info"
  },
  [OrderStatus.Completed]: {
    label: "已完成",
    tone: "success"
  },
  [OrderStatus.Cancelled]: {
    label: "已取消",
    tone: "muted"
  }
};

export function getOrderStatusMeta(status: OrderStatus): (typeof ORDER_STATUS_META)[OrderStatus] {
  return ORDER_STATUS_META[status];
}
