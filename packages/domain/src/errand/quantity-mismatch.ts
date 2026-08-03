type Quantities = {
  requiredQuantity: number;
  purchasedQuantity: number;
  distributedQuantity: number | null;
};

export function getQuantityMismatchLabel({
  requiredQuantity,
  purchasedQuantity,
  distributedQuantity,
}: Quantities): string | null {
  const distributed = distributedQuantity ?? 0;
  if (
    requiredQuantity === purchasedQuantity &&
    purchasedQuantity === distributed
  ) {
    return null;
  }
  if (requiredQuantity === distributed) {
    return "采购数量与需求、分发数量均不一致";
  }
  if (purchasedQuantity === distributed) {
    return "采购数量与需求不一致";
  }
  if (requiredQuantity === purchasedQuantity) {
    return "分发数量与采购不一致";
  }
  return "三项数量不一致";
}
