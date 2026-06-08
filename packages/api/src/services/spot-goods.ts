import { createClient } from "@connectrpc/connect"
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt"
import type { ProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import type {
  SpotGoodsBrief as ProtoSpotGoodsBrief,
  SpotGoodsDetail as ProtoSpotGoodsDetail,
} from "../gen/sast/sastshopv2/spot/v1/spot_goods_pb"
import { SpotGoodsService } from "../gen/sast/sastshopv2/spot/v1/spot_goods_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"
import { listStores } from "./catalog"

export interface SpotProductTemplate {
  id: string
  title: string
  description: string
  priceCents: number
  storeId: string
  mainImageUrl: string
  barcode: string
  updatedAt: string | null
}

export interface SpotGoods {
  id: string
  product: SpotProductTemplate
  salePriceCents: number
  stock: number | null
  sellerId: string | null
  sellerName: string | null
  updatedAt: string | null
}

export interface CreateSpotGoodsInput {
  productTemplateId: string
  salePriceCents: number
  stockTotal: number
  productTemplateUpdatedAt?: TimestampInput
}

export async function listSpotGoods(
  options: ServiceOptions & { storeId?: string; page?: number; pageSize?: number } = {}
): Promise<SpotGoods[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    if (options.storeId) {
      return listSpotGoodsByStore(options.storeId, options)
    }

    const stores = await listStores(options)
    const goods = await Promise.all(
      stores.map((store) => listSpotGoodsByStore(store.id, options))
    )

    return goods.flat()
  }

  throw new FeatureUnavailableError("listSpotGoods")
}

export async function getSpotGoods(
  id: string,
  options: ServiceOptions = {}
): Promise<SpotGoods> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(SpotGoodsService, createLocalTransport(options))
    const response = await requestLocal("getSpotGoods", () =>
      client.getSpotGoods({ spotGoodsId: parseInt64(id, "现货商品 ID 不正确") })
    )

    if (!response.spotGoodsDetail) {
      throw new FeatureUnavailableError("getSpotGoods")
    }

    return mapSpotGoodsDetail(response.spotGoodsDetail)
  }

  throw new FeatureUnavailableError("getSpotGoods")
}

export async function createSpotGoods(
  input: CreateSpotGoodsInput,
  options: ServiceOptions = {}
): Promise<SpotGoods> {
  validateCreateSpotGoodsInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(SpotGoodsService, createLocalTransport(options))
    const response = await requestLocal("createSpotGoods", () =>
      client.createSpotGoods({
        productTemplateId: parseInt64(
          input.productTemplateId,
          "商品模板 ID 不正确"
        ),
        salePriceCents: input.salePriceCents,
        stockTotal: input.stockTotal,
        productTemplateUpdatedAt: parseTimestampInput(
          input.productTemplateUpdatedAt
        ),
      })
    )

    if (!response.spotGoodsDetail) {
      throw new FeatureUnavailableError("createSpotGoods")
    }

    return mapSpotGoodsDetail(response.spotGoodsDetail)
  }

  throw new FeatureUnavailableError("createSpotGoods")
}

async function listSpotGoodsByStore(
  storeId: string,
  options: ServiceOptions & { page?: number; pageSize?: number }
): Promise<SpotGoods[]> {
  const client = createClient(SpotGoodsService, createLocalTransport(options))
  const response = await requestLocal("listSpotGoods", () =>
    client.listSpotGoods({
      storeId: parseInt64(storeId, "店铺 ID 不正确"),
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 50,
    })
  )

  const details = await Promise.all(
    response.spotGoodsList.map((goods) =>
      getSpotGoods(goods.id.toString(), options).catch(() =>
        mapSpotGoodsBrief(goods)
      )
    )
  )

  return details
}

function mapSpotGoodsBrief(goods: ProtoSpotGoodsBrief): SpotGoods {
  return {
    id: goods.id.toString(),
    product: mapTemplate(goods.productTemplate),
    salePriceCents: goods.salePriceCents,
    stock: null,
    sellerId: null,
    sellerName: null,
    updatedAt: formatTimestamp(goods.updatedAt),
  }
}

function mapSpotGoodsDetail(goods: ProtoSpotGoodsDetail): SpotGoods {
  return {
    id: goods.id.toString(),
    product: mapTemplate(goods.productTemplate),
    salePriceCents: goods.salePriceCents,
    stock: goods.stock,
    sellerId: goods.seller?.id.toString() ?? null,
    sellerName: goods.seller?.name ?? null,
    updatedAt: formatTimestamp(goods.updatedAt),
  }
}

function mapTemplate(template?: ProductTemplate): SpotProductTemplate {
  return {
    id: template?.id.toString() ?? "0",
    title: template?.title ?? "未命名商品",
    description: template?.description ?? "",
    priceCents: template?.priceCents ?? 0,
    storeId: template?.storeId.toString() ?? "0",
    mainImageUrl: template?.mainImageUrl ?? "",
    barcode: template?.barcode ?? "",
    updatedAt: formatTimestamp(template?.updatedAt),
  }
}

type TimestampInput = string | Timestamp | null

function validateCreateSpotGoodsInput(input: CreateSpotGoodsInput) {
  parseInt64(input.productTemplateId, "商品模板 ID 不正确")

  if (!Number.isInteger(input.salePriceCents) || input.salePriceCents <= 0) {
    throw new ValidationError("现货售价不正确")
  }

  if (!Number.isInteger(input.stockTotal) || input.stockTotal <= 0) {
    throw new ValidationError("现货库存不正确")
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

function formatTimestamp(timestamp?: Timestamp): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null
}
