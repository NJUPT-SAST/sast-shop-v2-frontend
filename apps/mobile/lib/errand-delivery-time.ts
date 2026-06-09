const DELIVERY_CUTOFF_HOUR = 20;
const DEFAULT_DELIVERY_HOUR = 22;
const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

export function getDefaultErrandDeadline(now = new Date()): Date {
  const deadline = new Date(now);
  deadline.setHours(DEFAULT_DELIVERY_HOUR, 0, 0, 0);

  if (now.getHours() >= DELIVERY_CUTOFF_HOUR) {
    deadline.setDate(deadline.getDate() + 1);
  }

  if (deadline.getTime() - now.getTime() < MIN_LEAD_TIME_MS) {
    deadline.setDate(deadline.getDate() + 1);
  }

  return deadline;
}

export function isValidErrandDeadline(
  deadline: Date,
  now = new Date(),
): boolean {
  return deadline.getTime() - now.getTime() >= MIN_LEAD_TIME_MS;
}

export function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}
