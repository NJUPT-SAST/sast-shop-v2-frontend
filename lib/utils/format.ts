// Pure formatting helpers used across the UI. No React, no I/O — easy to unit test.

const CNY_FORMATTER = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—"
  const n = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(n)) return "—"
  return CNY_FORMATTER.format(n)
}

export function sumPrice(...values: Array<string | number | null | undefined>): string {
  let total = 0
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue
    const n = typeof v === "string" ? Number(v) : v
    if (Number.isFinite(n)) total += n
  }
  return total.toFixed(2)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function formatPercent(part: number, total: number): string {
  if (!total || total <= 0) return "0%"
  const pct = Math.min(100, Math.max(0, (part / total) * 100))
  return `${Math.round(pct)}%`
}

export function diffCountdown(deadline: string | null | undefined): {
  expired: boolean
  text: string
} {
  if (!deadline) return { expired: false, text: "—" }
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return { expired: false, text: "—" }
  if (ms <= 0) return { expired: true, text: "已截止" }
  const day = Math.floor(ms / 86_400_000)
  const hour = Math.floor((ms % 86_400_000) / 3_600_000)
  if (day > 0) return { expired: false, text: `剩余 ${day} 天 ${hour} 时` }
  const minute = Math.floor((ms % 3_600_000) / 60_000)
  return { expired: false, text: `剩余 ${hour} 时 ${minute} 分` }
}

export function shortenId(id: string, length = 8): string {
  if (!id) return ""
  return id.length <= length ? id : id.slice(0, length).toUpperCase()
}
