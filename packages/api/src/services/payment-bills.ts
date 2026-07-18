import { createClient } from "@connectrpc/connect";
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt";
import {
  BillStatus,
  type Bill as ProtoBill,
} from "../gen/sast/sastshopv2/payment/v1/bill_pb";
import { BillService } from "../gen/sast/sastshopv2/payment/v1/bill_service_pb";
import { Channel } from "../gen/sast/sastshopv2/payment/v1/channel_pb";
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";
import type { PaymentQrChannel } from "./payment-qr-codes";

const MAX_SIGNED_INT64 = 9223372036854775807n;

export type PaymentBillStatus =
  "unpaid" | "submitted" | "completed" | "closed" | "unknown";

export interface PaymentBillUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface PaymentBill {
  id: string;
  billNo: string;
  payer: PaymentBillUser | null;
  payee: PaymentBillUser | null;
  status: PaymentBillStatus;
  amountCents: number;
  verifyCode: string;
  channel: PaymentQrChannel | null;
  serialNumber: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
}

export interface PayBillInput {
  billId: string;
  channel: PaymentQrChannel;
  updatedAt: TimestampInput;
}

export interface ConfirmBillInput {
  billId: string;
  updatedAt: TimestampInput;
}

export interface SupplementBillSerialNumberInput {
  billId: string;
  serialNumber: string;
  updatedAt: TimestampInput;
}

type TimestampInput = string | Timestamp;

export async function getBill(
  billId: string,
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const parsedBillId = parseInt64(billId, "账单 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("getBill", () =>
      client.getBill({ billId: parsedBillId }),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("getBill");
    }

    return mapPaymentBill(response.bill);
  }

  throw new FeatureUnavailableError("getBill");
}

export async function payBill(
  input: PayBillInput,
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const parsedInput = validatePayBillInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("payBill", () =>
      client.payBill(parsedInput),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("payBill");
    }

    return mapPaymentBill(response.bill);
  }

  throw new FeatureUnavailableError("payBill");
}

export async function confirmBill(
  input: ConfirmBillInput,
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const parsedInput = validateConfirmBillInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("confirmBill", () =>
      client.confirmBill(parsedInput),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("confirmBill");
    }

    return mapPaymentBill(response.bill);
  }

  throw new FeatureUnavailableError("confirmBill");
}

export async function supplementBillSerialNumber(
  input: SupplementBillSerialNumberInput,
  options: ServiceOptions = {},
): Promise<PaymentBill> {
  const parsedInput = validateSupplementSerialNumberInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(BillService, createLocalTransport(options));
    const response = await requestLocal("supplementBillSerialNumber", () =>
      client.supplementSerialNumber(parsedInput),
    );

    if (!response.bill) {
      throw new FeatureUnavailableError("supplementBillSerialNumber");
    }

    return mapPaymentBill(response.bill);
  }

  throw new FeatureUnavailableError("supplementBillSerialNumber");
}

export function mapPaymentBill(bill: ProtoBill): PaymentBill {
  return {
    id: bill.id.toString(),
    billNo: bill.billNo,
    payer: mapUserInfo(bill.payer),
    payee: mapUserInfo(bill.payee),
    status: mapStatusFromProto(bill.status),
    amountCents: bill.amountCents,
    verifyCode: bill.verifyCode,
    channel: mapChannelFromProto(bill.channel),
    serialNumber: bill.serialNumber ?? null,
    submittedAt: formatTimestamp(bill.submittedAt),
    completedAt: formatTimestamp(bill.completedAt),
    closedAt: formatTimestamp(bill.closedAt),
    createdAt: formatTimestamp(bill.createdAt),
    updatedAt: formatTimestamp(bill.updatedAt),
    sourceType: bill.sourceType ?? null,
    sourceId: bill.sourceId?.toString() ?? null,
  };
}

function validatePayBillInput(input: PayBillInput) {
  return {
    billId: parseInt64(input.billId, "账单 ID 不正确"),
    channel: mapPaymentChannelToProto(input.channel),
    updatedAt: parseTimestampInput(input.updatedAt),
  };
}

function validateConfirmBillInput(input: ConfirmBillInput) {
  return {
    billId: parseInt64(input.billId, "账单 ID 不正确"),
    updatedAt: parseTimestampInput(input.updatedAt),
  };
}

function validateSupplementSerialNumberInput(
  input: SupplementBillSerialNumberInput,
) {
  const serialNumber = input.serialNumber.trim();

  if (!serialNumber) {
    throw new ValidationError("支付流水号不能为空");
  }

  if (!/^[A-Za-z0-9-]{6,64}$/.test(serialNumber)) {
    throw new ValidationError("支付流水号格式不正确");
  }

  return {
    billId: parseInt64(input.billId, "账单 ID 不正确"),
    serialNumber,
    updatedAt: parseTimestampInput(input.updatedAt),
  };
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message);
  }

  const parsed = BigInt(value);
  if (parsed > MAX_SIGNED_INT64) {
    throw new ValidationError(message);
  }

  return parsed;
}

function parseTimestampInput(input: TimestampInput): Timestamp {
  if (!input) {
    throw new ValidationError("账单更新时间不能为空");
  }

  if (typeof input !== "string") {
    return input;
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("账单更新时间不正确");
  }

  return timestampFromDate(date);
}

function formatTimestamp(timestamp?: Timestamp): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null;
}

function mapUserInfo(userInfo?: UserInfo): PaymentBillUser | null {
  if (!userInfo) {
    return null;
  }

  return {
    id: userInfo.id.toString(),
    name: userInfo.name,
    avatarUrl: userInfo.avatarUrl,
  };
}

function mapStatusFromProto(status: BillStatus): PaymentBillStatus {
  if (status === BillStatus.UNPAID) return "unpaid";
  if (status === BillStatus.SUBMITTED) return "submitted";
  if (status === BillStatus.COMPLETED) return "completed";
  if (status === BillStatus.CLOSED) return "closed";
  return "unknown";
}

function mapChannelFromProto(channel: Channel): PaymentQrChannel | null {
  if (channel === Channel.WECHAT) return "wechat";
  if (channel === Channel.ALIPAY) return "alipay";
  return null;
}

function mapPaymentChannelToProto(channel: PaymentQrChannel): Channel {
  if (channel === "wechat") {
    return Channel.WECHAT;
  }

  if (channel === "alipay") {
    return Channel.ALIPAY;
  }

  throw new ValidationError("支付渠道不正确");
}
