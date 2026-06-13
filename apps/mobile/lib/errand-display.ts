const MAX_DISPLAY_YUAN = 999
const MAX_DISPLAY_COUNT = 999

export function formatErrandDisplayPrice(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) {
    return "¥0"
  }

  if (cents > MAX_DISPLAY_YUAN * 100) {
    return `¥${MAX_DISPLAY_YUAN}+`
  }

  return `¥${Math.round(cents / 100)}`
}

export function formatErrandDisplayCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return "0"
  }

  if (count > MAX_DISPLAY_COUNT) {
    return `${MAX_DISPLAY_COUNT}+`
  }

  return String(count)
}
