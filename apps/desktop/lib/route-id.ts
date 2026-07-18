const MAX_SIGNED_INT64 = 9223372036854775807n

export function parsePositiveInt64RouteId(value: string): string | null {
  if (!/^[1-9]\d*$/.test(value)) return null
  return BigInt(value) <= MAX_SIGNED_INT64 ? value : null
}
