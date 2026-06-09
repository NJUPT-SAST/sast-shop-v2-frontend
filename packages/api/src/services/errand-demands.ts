import { createClient } from "@connectrpc/connect"
import {
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt"
import { ErrandDemandService } from "../gen/sast/sastshopv2/errand/v1/errand_demand_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

const MAX_SIGNED_INT64 = 9223372036854775807n

export interface CreateErrandDemandInput {
  storeId: string
  deadline: string
  items: Array<{
    productTemplateId: string
    quantity: number
    serviceFeePerUnitCents: number
    updatedAt?: string | null
  }>
}

export interface CreateErrandDemandResult {
  errandDemandId: string
}

export async function createErrandDemand(
  input: CreateErrandDemandInput,
  options: ServiceOptions = {}
): Promise<CreateErrandDemandResult> {
  const request = parseCreateErrandDemandInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandDemandService, createLocalTransport(options))
    const response = await requestLocal("createErrandDemand", () =>
      client.createErrandDemand(request)
    )

    return { errandDemandId: response.errandDemandId.toString() }
  }

  throw new FeatureUnavailableError("createErrandDemand")
}

function parseCreateErrandDemandInput(input: CreateErrandDemandInput) {
  if (input.items.length === 0) {
    throw new ValidationError("跑腿需求商品不能为空")
  }

  return {
    storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
    deadline: parseRequiredTimestamp(input.deadline, "期望送达时间不正确"),
    demandItems: input.items.map((item) => {
      const updatedAt = parseOptionalTimestamp(
        item.updatedAt,
        "商品更新时间不正确"
      )

      return {
        productTemplateId: parseInt64(
          item.productTemplateId,
          "商品模板 ID 不正确"
        ),
        quantity: parsePositiveInteger(item.quantity, "跑腿需求数量不正确"),
        serviceFeePerUnitCents: parseNonNegativeInteger(
          item.serviceFeePerUnitCents,
          "跑腿费不正确"
        ),
        ...(updatedAt ? { updatedAt } : {}),
      }
    }),
  }
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message)
  }

  const parsed = BigInt(value)

  if (parsed > MAX_SIGNED_INT64) {
    throw new ValidationError(message)
  }

  return parsed
}

function parseRequiredTimestamp(value: string, message: string): Timestamp {
  return parseTimestamp(value, message)
}

function parseOptionalTimestamp(
  value: string | null | undefined,
  message: string
): Timestamp | undefined {
  if (!value) {
    return undefined
  }

  return parseTimestamp(value, message)
}

function parseTimestamp(value: string, message: string): Timestamp {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message)
  }

  return timestampFromDate(date)
}

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message)
  }

  return value
}

function parseNonNegativeInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(message)
  }

  return value
}
