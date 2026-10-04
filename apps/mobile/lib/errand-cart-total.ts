import { parseYuanToCents } from "@sast-shop/domain";

type CartPriceItem = {
  quantity: number;
  priceCents: number;
  serviceFeeDraft: string;
};

export function calculateErrandCartTotal(items: CartPriceItem[]) {
  let quantity = 0;
  let productCents = 0;
  let serviceFeeCents: number | null = 0;

  for (const item of items) {
    quantity += item.quantity;
    productCents += item.priceCents * item.quantity;
    const fee =
      item.serviceFeeDraft === "" ? 0 : parseYuanToCents(item.serviceFeeDraft);
    if (fee === null) {
      serviceFeeCents = null;
    } else if (serviceFeeCents !== null) {
      serviceFeeCents += fee * item.quantity;
    }
  }

  return {
    quantity,
    productCents,
    serviceFeeCents,
    totalCents:
      serviceFeeCents === null ? null : productCents + serviceFeeCents,
  };
}
