import { create } from "@bufbuild/protobuf";
import { TimestampSchema, type Timestamp } from "@bufbuild/protobuf/wkt";

import { ValidationError } from "./errors";

const RFC3339_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

export function parseProtoTimestamp(value: string, message: string): Timestamp {
  const normalized = value.trim();
  const match = RFC3339_TIMESTAMP.exec(normalized);

  if (!match) throw new ValidationError(message);

  const wholeSeconds = match[1];
  const milliseconds = Date.parse(`${wholeSeconds}Z`);

  if (
    Number.isNaN(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 19) !== wholeSeconds
  ) {
    throw new ValidationError(message);
  }

  return create(TimestampSchema, {
    seconds: BigInt(Math.floor(milliseconds / 1000)),
    nanos: Number((match[2] ?? "").padEnd(9, "0")),
  });
}

export function formatProtoTimestamp(timestamp?: Timestamp): string | null {
  if (!timestamp) return null;

  const date = new Date(Number(timestamp.seconds) * 1000);
  const wholeSeconds = date.toISOString().slice(0, 19);

  if (timestamp.nanos === 0) {
    return `${wholeSeconds}.000Z`;
  }

  const fraction = timestamp.nanos
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return `${wholeSeconds}.${fraction}Z`;
}
