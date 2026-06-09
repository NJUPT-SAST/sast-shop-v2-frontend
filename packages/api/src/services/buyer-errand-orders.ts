import { createClient } from "@connectrpc/connect"
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb"
import type { BuyerErrandOrderBrief as ProtoBuyerErrandOrderBrief } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_pb"
import { BuyerErrandOrderService } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_service_pb"
import { ErrandDemandStatus } from "../gen/sast/sastshopv2/errand/v1/errand_demand_status_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"
import type { Store } from "./catalog"
import type { ProductTemplate } from "./product-templates"

const MAX_SIGNED_INT64 = 9223372036854775807n

export type BuyerErrandOrderStatus =
  | "open"
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "pending_payment"
  | "completed"
  | "cancelled"
  | "unknown"

export type BuyerErrandOrderStatusFilter = Exclude<
  BuyerErrandOrderStatus,
  "unknown"
>

export interface BuyerErrandOrder {
  id: string
  storeId: string
  createdAt: string | null
  store: Store | null
  status: BuyerErrandOrderStatus
  productTemplates: ProductTemplate[]
  totalOriginAmountCents: number
  totalActualAmountCents: number | null
  totalServiceFeeCents: number
  productTotalCount: number
}

export async function listBuyerErrandOrders(
  options: ServiceOptions & {
    storeId?: string
    status?: BuyerErrandOrderStatusFilter
    page?: number
    pageSize?: number
  } = {}
): Promise<BuyerErrandOrder[]> {
  const request = parseListBuyerErrandOrdersOptions(options)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      BuyerErrandOrderService,
      createLocalTransport(options)
    )
    const response = await requestLocal("listBuyerErrandOrders", () =>
      client.getBuyerErrandOrderBrief(request)
    )

    return response.orders.map(mapBuyerErrandOrder)
  }

  throw new FeatureUnavailableError("listBuyerErrandOrders")
}

function parseListBuyerErrandOrdersOptions(
  options: {
    storeId?: string
    status?: BuyerErrandOrderStatusFilter
    page?: number
    pageSize?: number
  }
) {
  return {
    page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
    pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
    ...(options.storeId
      ? { storeIdFilter: parseInt64(options.storeId, "店铺 ID 不正确") }
      : {}),
    ...(options.status
      ? { statusFilter: parseStatusFilter(options.status) }
      : {}),
  }
}

function mapBuyerErrandOrder(
  order: ProtoBuyerErrandOrderBrief
): BuyerErrandOrder {
  return {
    id: order.errandDemandId.toString(),
    storeId: order.storeId.toString(),
    createdAt: formatTimestamp(order.createdAt),
    store: mapStore(order.storeInfo),
    status: mapStatusFromProto(order.status),
    productTemplates: order.productTemplates.map(mapProductTemplate),
    totalOriginAmountCents: order.totalOriginAmountCents,
    totalActualAmountCents: order.totalActualAmountCents ?? null,
    totalServiceFeeCents: order.totalServiceFeeCents,
    productTotalCount: order.productTotalCount,
  }
}

function mapStore(store?: ProtoStore): Store | null {
  if (!store) {
    return null
  }

  return {
    id: store.id.toString(),
    name: store.name,
    address: store.address,
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
  }
}

function mapProductTemplate(template: ProtoProductTemplate): ProductTemplate {
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

function mapStatusFromProto(
  status: ErrandDemandStatus
): BuyerErrandOrderStatus {
  if (status === ErrandDemandStatus.OPEN) return "open"
  if (status === ErrandDemandStatus.SHOPPING) return "shopping"
  if (status === ErrandDemandStatus.PENDING_DISTRIBUTING) {
    return "pending_distributing"
  }
  if (status === ErrandDemandStatus.DISTRIBUTING) return "distributing"
  if (status === ErrandDemandStatus.PENDING_PAYMENT) return "pending_payment"
  if (status === ErrandDemandStatus.COMPLETED) return "completed"
  if (status === ErrandDemandStatus.CANCELLED) return "cancelled"
  return "unknown"
}

function parseStatusFilter(status: string): ErrandDemandStatus {
  const protoStatus = mapStatusToProto(status)

  if (protoStatus === undefined) {
    throw new ValidationError("跑腿订单状态不正确")
  }

  return protoStatus
}

function mapStatusToProto(status: string): ErrandDemandStatus | undefined {
  if (status === "open") return ErrandDemandStatus.OPEN
  if (status === "shopping") return ErrandDemandStatus.SHOPPING
  if (status === "pending_distributing") {
    return ErrandDemandStatus.PENDING_DISTRIBUTING
  }
  if (status === "distributing") return ErrandDemandStatus.DISTRIBUTING
  if (status === "pending_payment") return ErrandDemandStatus.PENDING_PAYMENT
  if (status === "completed") return ErrandDemandStatus.COMPLETED
  if (status === "cancelled") return ErrandDemandStatus.CANCELLED
  return undefined
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

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message)
  }

  return value
}

function formatTimestamp(
  timestamp: { seconds: bigint; nanos: number } | undefined
): string | null {
  if (!timestamp) {
    return null
  }

  return new Date(
    Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000)
  ).toISOString()
}
