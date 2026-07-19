type Quantities = {
  requiredQuantity: number;
  purchasedQuantity: number;
  distributedQuantity: number;
};

export function getQuantityMismatchLabel({
  requiredQuantity,
  purchasedQuantity,
  distributedQuantity,
}: Quantities): string | null {
  if (
    requiredQuantity === purchasedQuantity &&
    purchasedQuantity === distributedQuantity
  ) {
    return null;
  }
  if (requiredQuantity === distributedQuantity) {
    return "采购数量与需求、分发数量均不一致";
  }
  if (purchasedQuantity === distributedQuantity) {
    return "采购数量与需求不一致";
  }
  if (requiredQuantity === purchasedQuantity) {
    return "分发数量与采购不一致";
  }
  return "三项数量不一致";
}
