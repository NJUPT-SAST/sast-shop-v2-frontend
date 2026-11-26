export interface ProductCategorySelectionItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

export function getDefaultProductCategoryId(
  categories: ProductCategorySelectionItem[],
): string | null {
  const ordered = [...categories].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || compareIds(left.id, right.id),
  );
  const firstRoot = ordered.find((category) => category.parentId === null);
  if (!firstRoot) return null;
  return (
    ordered.find((category) => category.parentId === firstRoot.id)?.id ??
    firstRoot.id
  );
}

function compareIds(left: string, right: string): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}
