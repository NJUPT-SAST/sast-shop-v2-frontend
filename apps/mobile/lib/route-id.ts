const POSITIVE_INTEGER_ID_PATTERN = /^[1-9]\d*$/

export function isValidRouteId(value: string): boolean {
  return POSITIVE_INTEGER_ID_PATTERN.test(value)
}
