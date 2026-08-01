export function formatPrice(cents: number): string {
  const yuan = cents / 100;

  return `¥${Number.isInteger(yuan) ? yuan.toString() : yuan.toFixed(2)}`;
}
