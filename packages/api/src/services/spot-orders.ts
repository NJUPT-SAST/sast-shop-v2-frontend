import { createClient } from "@connectrpc/connect"
import {
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt"
import type { ProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb"
import { SpotGoodsPerspective } from "../gen/sast/sastshopv2/spot/v1/spot_goods_perspective_pb"
import type { SpotOrderDetail as ProtoSpotOrderDetail } from "../gen/sast/sastshopv2/spot/v1/spot_order_pb"
import type { SpotOrderBrief as ProtoSpotOrderBrief } from "../gen/sast/sastshopv2/spot/v1/spot_order_pb"
import { SpotOrderService } from "../gen/sast/sastshopv2/spot/v1/spot_order_service_pb"
import { SpotOrderStatus } from "../gen/sast/sastshopv2/spot/v1/spot_order_status_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"
import { listStores, type Store } from "./catalog"

export type SpotOrderPerspective = "purchaser" | "seller"
export type SpotOrderStatusValue =
  | "pending_payment"
  | "paid"
  | "completed"
  | "cancelled"
  | "unknown"

export interface SpotOrder {
  id: string
  orderNo: string
  store: Store | null
  productTitle: string
  productDescription: string
  quantity: number
  unitPriceCents: number
  totalAmountCents: number
  status: SpotOrderStatusValue
}

export interface CreateSpotOrderInput {
  spotGoodsId: string
  quantity: number
  updatedAt?: TimestampInput
}

export async function listSpotOrders(
  options: ServiceOptions & {
    storeId?: string
    perspective?: SpotOrderPerspective
    status?: SpotOrderStatusValue
    page?: number
    pageSize?: number
  } = {}
): Promise<SpotOrder[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    if (options.storeId) {
      return listSpotOrdersByStore(options.storeId, options)
    }

    const stores = await listStores(options)
    const orders = await Promise.all(
      stores.map((store) => listSpotOrdersByStore(store.id, options))
    )

    return orders.flat()
  }

  throw new FeatureUnavailableError("listSpotOrders")
}

export async function createSpotOrders(
  inputs: CreateSpotOrderInput[],
  options: ServiceOptions = {}
): Promise<SpotOrder[]> {
  validateCreateSpotOrdersInput(inputs)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(SpotOrderService, createLocalTransport(options))
    const response = await requestLocal("createSpotOrders", () =>
      client.createSpotOrders({
        spotOrders: inputs.map((input) => ({
          spotListingId: parseInt64(input.spotGoodsId, "现货商品 ID 不正确"),
          quantity: input.quantity,
          updatedAt: parseTimestampInput(input.updatedAt),
        })),
      })
    )

    return response.spotOrderDetails.map(mapSpotOrderDetail)
  }

  throw new FeatureUnavailableError("createSpotOrders")
}

async function listSpotOrdersByStore(
  storeId: string,
  options: ServiceOptions & {
    perspective?: SpotOrderPerspective
    status?: SpotOrderStatusValue
    page?: number
    pageSize?: number
  }
): Promise<SpotOrder[]> {
  const client = createClient(SpotOrderService, createLocalTransport(options))
  const response = await requestLocal("listSpotOrders", () =>
    client.listSpotOrder({
      storeId: parseInt64(storeId, "店铺 ID 不正确"),
      perspective: mapPerspective(options.perspective ?? "purchaser"),
      filterStatus: options.status ? mapStatusToProto(options.status) : undefined,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 50,
    })
  )

  return response.spotOrders.map(mapSpotOrder)
}

function mapSpotOrder(order: ProtoSpotOrderBrief): SpotOrder {
  return {
    id: order.id.toString(),
    orderNo: order.orderNo,
    store: mapStore(order.store),
    productTitle: mapTemplate(order.productSnapshot).title,
    productDescription: mapTemplate(order.productSnapshot).description,
    quantity: order.quantity,
    unitPriceCents: order.unitPriceCents,
    totalAmountCents: order.totalAmountCents,
    status: mapStatusFromProto(order.status),
  }
}

function mapSpotOrderDetail(order: ProtoSpotOrderDetail): SpotOrder {
  return {
    id: order.id.toString(),
    orderNo: order.orderNo,
    store: mapStore(order.store),
    productTitle: mapTemplate(order.productSnapshot).title,
    productDescription: mapTemplate(order.productSnapshot).description,
    quantity: order.quantity,
    unitPriceCents: order.unitPriceCents,
    totalAmountCents: order.totalAmountCents,
    status: mapStatusFromProto(order.status),
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

function mapTemplate(template?: ProductTemplate) {
  return {
    title: template?.title ?? "未命名商品",
    description: template?.description ?? "",
  }
}

function mapPerspective(perspective: SpotOrderPerspective): SpotGoodsPerspective {
  return perspective === "seller"
    ? SpotGoodsPerspective.SELLER
    : SpotGoodsPerspective.PURCHASER
}

function mapStatusFromProto(status: SpotOrderStatus): SpotOrderStatusValue {
  if (status === SpotOrderStatus.PENDING_PAYMENT) return "pending_payment"
  if (status === SpotOrderStatus.PAID) return "paid"
  if (status === SpotOrderStatus.COMPLETED) return "completed"
  if (status === SpotOrderStatus.CANCELLED) return "cancelled"
  return "unknown"
}

function mapStatusToProto(status: SpotOrderStatusValue): SpotOrderStatus | undefined {
  if (status === "pending_payment") return SpotOrderStatus.PENDING_PAYMENT
  if (status === "paid") return SpotOrderStatus.PAID
  if (status === "completed") return SpotOrderStatus.COMPLETED
  if (status === "cancelled") return SpotOrderStatus.CANCELLED
  return undefined
}

type TimestampInput = string | Timestamp | null

function validateCreateSpotOrdersInput(inputs: CreateSpotOrderInput[]) {
  if (inputs.length === 0) {
    throw new ValidationError("现货订单不能为空")
  }

  for (const input of inputs) {
    parseInt64(input.spotGoodsId, "现货商品 ID 不正确")

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ValidationError("现货购买数量不正确")
    }
  }
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message)
  }

  return BigInt(value)
}

function parseTimestampInput(input?: TimestampInput): Timestamp | undefined {
  if (!input) {
    return undefined
  }

  if (typeof input === "string") {
    return timestampFromDate(new Date(input))
  }

  return input
}
