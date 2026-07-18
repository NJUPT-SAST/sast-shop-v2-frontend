import { createClient } from "@connectrpc/connect"
import type { Timestamp } from "@bufbuild/protobuf/wkt"
import type { ProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import type {
  SpotGoodsBrief as ProtoSpotGoodsBrief,
  SpotGoodsDetail as ProtoSpotGoodsDetail,
} from "../gen/sast/sastshopv2/spot/v1/spot_goods_pb"
import { SpotGoodsService } from "../gen/sast/sastshopv2/spot/v1/spot_goods_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"
import { formatProtoTimestamp, parseProtoTimestamp } from "../proto-timestamp"
import { listStores } from "./catalog"

const MAX_SIGNED_INT64 = 9223372036854775807n
const MAX_SIGNED_INT32 = 2147483647

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
  productTemplateUpdatedAt: TimestampInput
}

export async function listSpotGoods(
  options: ServiceOptions & { storeId?: string; page?: number; pageSize?: number } = {}
): Promise<SpotGoods[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    if (options.storeId) {
      const goods = await listSpotGoodsBriefsByStore(options.storeId, options)
      return hydrateSpotGoods(goods, options)
    }

    const stores = await listStores(options)
    const goods = await Promise.all(
      stores.map((store) => listSpotGoodsBriefsByStore(store.id, options))
    )

    return hydrateSpotGoods(deduplicateSpotGoods(goods.flat()), options)
  }

  throw new FeatureUnavailableError("listSpotGoods")
}

function hydrateSpotGoods(
  goods: SpotGoods[],
  options: ServiceOptions
): Promise<SpotGoods[]> {
  return Promise.all(
    goods.map((item) => getSpotGoods(item.id, options).catch(() => item))
  )
}

function deduplicateSpotGoods(goods: SpotGoods[]): SpotGoods[] {
  const uniqueGoods = new Map<string, SpotGoods>()

  for (const item of goods) {
    if (!uniqueGoods.has(item.id)) uniqueGoods.set(item.id, item)
  }

  return [...uniqueGoods.values()]
}

export async function getSpotGoods(
  id: string,
  options: ServiceOptions = {}
): Promise<SpotGoods> {
  const spotGoodsId = parseInt64(id, "现货商品 ID 不正确")
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(SpotGoodsService, createLocalTransport(options))
    const response = await requestLocal("getSpotGoods", () =>
      client.getSpotGoods({ spotGoodsId })
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
  const parsedInput = validateCreateSpotGoodsInput(input)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(SpotGoodsService, createLocalTransport(options))
    const response = await requestLocal("createSpotGoods", () =>
      client.createSpotGoods({
        ...parsedInput,
      })
    )

    if (!response.spotGoodsDetail) {
      throw new FeatureUnavailableError("createSpotGoods")
    }

    return mapSpotGoodsDetail(response.spotGoodsDetail)
  }

  throw new FeatureUnavailableError("createSpotGoods")
}

async function listSpotGoodsBriefsByStore(
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

  return response.spotGoodsList.map(mapSpotGoodsBrief)
}

function mapSpotGoodsBrief(goods: ProtoSpotGoodsBrief): SpotGoods {
  return {
    id: goods.id.toString(),
    product: mapTemplate(goods.productTemplate),
    salePriceCents: goods.salePriceCents,
    stock: null,
    sellerId: null,
    sellerName: null,
    updatedAt: formatProtoTimestamp(goods.updatedAt),
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
    updatedAt: formatProtoTimestamp(goods.updatedAt),
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
    updatedAt: formatProtoTimestamp(template?.updatedAt),
  }
}

type TimestampInput = string | Timestamp | null

function validateCreateSpotGoodsInput(input: CreateSpotGoodsInput) {
  const productTemplateId = parseInt64(
    input.productTemplateId,
    "商品模板 ID 不正确"
  )

  if (
    !Number.isInteger(input.salePriceCents) ||
    input.salePriceCents <= 0 ||
    input.salePriceCents > MAX_SIGNED_INT32
  ) {
    throw new ValidationError("现货售价不正确")
  }

  if (
    !Number.isInteger(input.stockTotal) ||
    input.stockTotal <= 0 ||
    input.stockTotal > MAX_SIGNED_INT32
  ) {
    throw new ValidationError("现货库存不正确")
  }

  return {
    productTemplateId,
    salePriceCents: input.salePriceCents,
    stockTotal: input.stockTotal,
    productTemplateUpdatedAt: parseTimestampInput(
      input.productTemplateUpdatedAt
    ),
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

function parseTimestampInput(input: TimestampInput): Timestamp {
  if (!input) {
    throw new ValidationError("商品模板更新时间不能为空")
  }

  if (typeof input === "string") {
    return parseProtoTimestamp(input, "商品模板更新时间不正确")
  }

  return input
}
