import { ValidationError } from "./errors";

/** A missing version is compatible only with the original round, never the latest one. */
export function parseLifecycleRound(value?: string): bigint {
  const round = value ?? "1";
  if (!/^[1-9]\d*$/.test(round) || BigInt(round) > 9223372036854775807n) {
    throw new ValidationError("处理轮次不正确，请刷新并核对订单后重试");
  }
  return BigInt(round);
}

export function mapLifecycleRound(value: bigint): string {
  return (value > 0n ? value : 1n).toString();
}
