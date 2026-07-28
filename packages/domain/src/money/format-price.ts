export function formatPrice(cents: number): string {
  const yuan = cents / 100;
//是整数直接输出，不是整数保留两位小数
  return `¥${Number.isInteger(yuan) ? yuan.toString() : yuan.toFixed(2)}`;
}
