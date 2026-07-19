export const MAX_INT32_CENTS = 2_147_483_647;

const yuanPattern = /^\d+(?:\.\d{1,2})?$/;

export function parseYuanToCents(value: string): number | null {
  if (value.length > 16 || !yuanPattern.test(value)) return null;

  const [yuan, fraction = ""] = value.split(".");
  const cents = BigInt(yuan) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(MAX_INT32_CENTS) ? Number(cents) : null;
}
