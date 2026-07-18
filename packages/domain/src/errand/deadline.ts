const DELIVERY_CUTOFF_HOUR = 20
const DEFAULT_DELIVERY_HOUR = 22
const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000

export function getDefaultErrandDeadline(now = new Date()): Date {
  const deadline = new Date(now)
  deadline.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0)
  if (now.getHours() >= DELIVERY_CUTOFF_HOUR) deadline.setDate(deadline.getDate() + 1)
  if (deadline.getTime() - now.getTime() < MIN_LEAD_TIME_MS) {
    deadline.setDate(deadline.getDate() + 1)
  }
  return deadline
}

export function isValidErrandDeadline(
  deadline: Date,
  now = new Date(),
): boolean {
  return deadline.getTime() - now.getTime() >= MIN_LEAD_TIME_MS
}

export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
