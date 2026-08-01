export type OrderStatus =
  | "pending_payment"
  | "pending_confirm"
  | "paid"
  | "processing"
  | "complete"
  | "cancelled";

export type StatusTone = "orange" | "blue" | "amber" | "emerald" | "muted";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    tone: StatusTone;
  }
> = {
  pending_payment: {
    label: "待支付",
    tone: "orange",
  },
  pending_confirm: {
    label: "待确认",
    tone: "amber",
  },
  paid: {
    label: "已支付",
    tone: "blue",
  },
  processing: {
    label: "处理中",
    tone: "blue",
  },
  complete: {
    label: "已完成",
    tone: "emerald",
  },
  cancelled: {
    label: "已取消",
    tone: "muted",
  },
};

export function getOrderStatusMeta(status: OrderStatus): {
  label: string;
  tone: StatusTone;
} {
  return ORDER_STATUS_META[status];
}
