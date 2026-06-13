import { createClient } from "@connectrpc/connect"
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt"
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import type { ErrandDemandByStore as ProtoErrandDemandByStore } from "../gen/sast/sastshopv2/errand/v1/errand_demand_by_store_pb"
import type { ErrandDemandDetail as ProtoErrandDemandDetail } from "../gen/sast/sastshopv2/errand/v1/errand_demand_detail_pb"
import type { ErrandDemandDetailRequester as ProtoErrandDemandDetailRequester } from "../gen/sast/sastshopv2/errand/v1/errand_demand_detail_requester_pb"
import { ErrandDemandService } from "../gen/sast/sastshopv2/errand/v1/errand_demand_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"
import type { ProductTemplate } from "./product-templates"

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

export interface ErrandDemandStoreSummary {
  storeId: string
  storeName: string
  participantAvatars: string[]
  totalOriginUnitPriceCents: number
  totalServiceFeeCents: number
  updatedAt: string | null
}

export interface ErrandDemandRequester {
  requesterId: string
  requesterName: string
  requesterAvatarUrl: string
  quantity: number
  serviceFeePerUnitCents: number
  errandDemandItemId: string
  deadline: string | null
  updatedAt: string | null
}

export interface ErrandDemandDetailGroup {
  errandDemandId: string
  productTemplate: ProductTemplate | null
  estimatedUnitPriceCents: number
  quantity: number
  requesters: ErrandDemandRequester[]
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

export async function listErrandDemandStores(
  options: ServiceOptions & {
    storeName?: string
    page?: number
    pageSize?: number
  } = {}
): Promise<ErrandDemandStoreSummary[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandDemandService, createLocalTransport(options))
    const response = await requestLocal("listErrandDemandStores", () =>
      client.getDemandList({
        page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
        pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
        ...(options.storeName?.trim()
          ? { storeName: options.storeName.trim() }
          : {}),
      })
    )

    return response.demands.map(mapErrandDemandStore)
  }

  throw new FeatureUnavailableError("listErrandDemandStores")
}

export async function getErrandDemandDetails(
  input: { storeId: string },
  options: ServiceOptions = {}
): Promise<ErrandDemandDetailGroup[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandDemandService, createLocalTransport(options))
    const response = await requestLocal("getErrandDemandDetails", () =>
      client.getDemandDetail({
        storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
      })
    )

    return response.details.map(mapErrandDemandDetail)
  }

  throw new FeatureUnavailableError("getErrandDemandDetails")
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

function mapErrandDemandStore(
  demand: ProtoErrandDemandByStore
): ErrandDemandStoreSummary {
  return {
    storeId: demand.storeId.toString(),
    storeName: demand.storeName,
    participantAvatars: demand.participantAvatars,
    totalOriginUnitPriceCents: demand.totalOriginUnitPriceCents,
    totalServiceFeeCents: demand.totalServiceFeeCents,
    updatedAt: formatTimestamp(demand.updatedAt),
  }
}

function mapErrandDemandDetail(
  detail: ProtoErrandDemandDetail
): ErrandDemandDetailGroup {
  return {
    errandDemandId: detail.errandDemandId.toString(),
    productTemplate: mapProductTemplate(detail.productTemplate),
    estimatedUnitPriceCents: detail.estimatedUnitPriceCents,
    quantity: detail.quantity,
    requesters: detail.requesters.map(mapErrandDemandRequester),
  }
}

function mapErrandDemandRequester(
  requester: ProtoErrandDemandDetailRequester
): ErrandDemandRequester {
  return {
    requesterId: requester.requesterId.toString(),
    requesterName: requester.requesterName,
    requesterAvatarUrl: requester.requesterAvatarUrl,
    quantity: requester.quantity,
    serviceFeePerUnitCents: requester.serviceFeePerUnitCents,
    errandDemandItemId: requester.errandDemandItemId.toString(),
    deadline: formatTimestamp(requester.deadline),
    updatedAt: formatTimestamp(requester.updatedAt),
  }
}

function mapProductTemplate(
  template: ProtoProductTemplate | undefined
): ProductTemplate | null {
  if (!template) {
    return null
  }

  return {
    id: template.id.toString(),
    title: template.title,
    description: template.description,
    priceCents: template.priceCents,
    storeId: template.storeId.toString(),
    mainImageUrl: template.mainImageUrl,
    barcode: template.barcode,
    updatedAt: formatTimestamp(template.updatedAt),
  }
}

function formatTimestamp(timestamp: Timestamp | undefined): string | null {
  if (!timestamp) {
    return null
  }

  return timestampDate(timestamp).toISOString()
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
