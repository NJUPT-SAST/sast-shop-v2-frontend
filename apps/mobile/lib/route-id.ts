const POSITIVE_INTEGER_ID_PATTERN = /^[1-9]\d*$/
const MAX_SIGNED_INT64 = 9223372036854775807n

export function isValidRouteId(value: string): boolean {
  return (
    POSITIVE_INTEGER_ID_PATTERN.test(value) && BigInt(value) <= MAX_SIGNED_INT64
  )
}
