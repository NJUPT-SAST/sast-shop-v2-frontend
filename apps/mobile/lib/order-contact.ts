export type OrderContactContext =
  | { orderType: "spot"; view: "buyer" | "seller" }
  | { orderType: "errand"; view: "participant" | "captain" };

export type OrderContactAction = {
  label: "联系卖家" | "联系团长";
  target: "spot-seller" | "errand-captain";
};

export function resolveOrderContactAction({
  orderType,
  view,
  isFeishuEnvironment,
}: OrderContactContext & {
  isFeishuEnvironment: boolean;
}): OrderContactAction | null {
  if (!isFeishuEnvironment) return null;

  if (orderType === "spot" && view === "buyer") {
    return { label: "联系卖家", target: "spot-seller" };
  }

  if (orderType === "errand" && view === "participant") {
    return { label: "联系团长", target: "errand-captain" };
  }

  return null;
}
