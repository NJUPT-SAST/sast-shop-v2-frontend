import { createClient } from "@connectrpc/connect";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { ProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb";
import type {
  SpotGoodsBrief as ProtoSpotGoodsBrief,
  SpotGoodsDetail as ProtoSpotGoodsDetail,
} from "../gen/sast/sastshopv2/spot/v1/spot_goods_pb";
import { SpotGoodsService } from "../gen/sast/sastshopv2/spot/v1/spot_goods_service_pb";
import { mapWithConcurrency } from "../concurrency";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";
import { formatProtoTimestamp, parseProtoTimestamp } from "../proto-timestamp";
import { listStores, type Store } from "./catalog";

const MAX_SIGNED_INT64 = 9223372036854775807n;
const MAX_SIGNED_INT32 = 2147483647;

export interface SpotProductTemplate {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  storeId: string;
  mainImageUrl: string;
  barcode: string;
  updatedAt: string | null;
}

export interface SpotGoods {
  id: string;
  product: SpotProductTemplate;
  salePriceCents: number;
  stock: number;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl: string;
  updatedAt: string;
}

/**
 * The create endpoint returns the newly-created row, rather than the full
 * detail shape returned by getSpotGoods. Keep that response separate so a
 * successful create does not require productTemplate or seller to be present.
 */
export interface CreatedSpotGoods {
  id: string;
  salePriceCents: number;
  stock: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SpotGoodsBrief {
  id: string;
  product: SpotProductTemplate;
  salePriceCents: number;
  updatedAt: string | null;
  store: Store;
}

export interface ListSpotGoodsResult {
  goods: SpotGoodsBrief[];
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export interface CreateSpotGoodsInput {
  productTemplateId: string;
  salePriceCents: number;
  stockTotal: number;
  productTemplateUpdatedAt: TimestampInput;
}

type SpotGoodsListClient = Pick<
  ReturnType<typeof createClient<typeof SpotGoodsService>>,
  "listSpotGoods"
>;

export async function listSpotGoods(
  options: ServiceOptions & {
    storeId?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ListSpotGoodsResult> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const storeId = parseStoreFilter(options.storeId);
    const page = parsePositiveInt32(options.page ?? 1, "页码不正确");
    const pageSize = parsePositiveInt32(
      options.pageSize ?? 50,
      "每页数量不正确",
    );
    const client = createClient(
      SpotGoodsService,
      createLocalTransport(options),
    );
    const stores = await listStores(options);
    const storesById = new Map(stores.map((store) => [store.id, store]));

    if (storeId > 0n) {
      const store = storesById.get(storeId.toString());
      if (!store) throw new FeatureUnavailableError("spotGoods.store");

      return listSpotGoodsByStorePage({
        client,
        store,
        page,
        pageSize,
      });
    }

    if (stores.length === 0) {
      return {
        goods: [],
        currentPage: page,
        totalCount: 0,
        pageSize,
      };
    }

    const pageLimit = page * pageSize;
    const pages = await mapWithConcurrency(stores, 4, (store) =>
      listSpotGoodsByStorePage({
        client,
        store,
        page: 1,
        pageSize: pageLimit,
      }),
    );
    const goods = pages.flatMap((result) => result.goods);
    const offset = (page - 1) * pageSize;

    return {
      goods: goods.slice(offset, offset + pageSize),
      currentPage: page,
      totalCount: pages.reduce((total, result) => total + result.totalCount, 0),
      pageSize,
    };
  }

  throw new FeatureUnavailableError("listSpotGoods");
}

async function listSpotGoodsByStorePage({
  client,
  store,
  page,
  pageSize,
}: {
  client: SpotGoodsListClient;
  store: Store;
  page: number;
  pageSize: number;
}): Promise<ListSpotGoodsResult> {
  const response = await requestLocal("listSpotGoods", () =>
    client.listSpotGoods({
      storeId: parseInt64(store.id, "店铺 ID 不正确"),
      page,
      pageSize,
    }),
  );

  if (
    !Number.isInteger(response.currentPage) ||
    response.currentPage !== page ||
    !Number.isInteger(response.totalCount) ||
    response.spotGoodsList.length > pageSize ||
    response.totalCount <
      (page - 1) * pageSize + response.spotGoodsList.length
  ) {
    throw new FeatureUnavailableError("listSpotGoods.pagination");
  }

  return {
    goods: response.spotGoodsList.map((goods) =>
      mapSpotGoodsBrief(goods, store),
    ),
    currentPage: response.currentPage,
    totalCount: response.totalCount,
    pageSize,
  };
}

export async function getSpotGoods(
  id: string,
  options: ServiceOptions = {},
): Promise<SpotGoods> {
  const spotGoodsId = parseInt64(id, "现货商品 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotGoodsService,
      createLocalTransport(options),
    );
    const response = await requestLocal("getSpotGoods", () =>
      client.getSpotGoods({ spotGoodsId }),
    );

    if (!response.spotGoodsDetail) {
      throw new FeatureUnavailableError("getSpotGoods");
    }

    return mapSpotGoodsDetail(response.spotGoodsDetail);
  }

  throw new FeatureUnavailableError("getSpotGoods");
}

export async function createSpotGoods(
  input: CreateSpotGoodsInput,
  options: ServiceOptions = {},
): Promise<CreatedSpotGoods> {
  const parsedInput = validateCreateSpotGoodsInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotGoodsService,
      createLocalTransport(options),
    );
    const response = await requestLocal("createSpotGoods", () =>
      client.createSpotGoods({
        ...parsedInput,
      }),
    );

    if (!response.spotGoodsDetail || response.spotGoodsDetail.id <= 0n) {
      throw new FeatureUnavailableError("createSpotGoods");
    }

    return mapCreatedSpotGoods(response.spotGoodsDetail);
  }

  throw new FeatureUnavailableError("createSpotGoods");
}

function mapCreatedSpotGoods(goods: ProtoSpotGoodsDetail): CreatedSpotGoods {
  return {
    id: goods.id.toString(),
    salePriceCents: goods.salePriceCents,
    stock: goods.stock,
    createdAt: formatProtoTimestamp(goods.createdAt),
    updatedAt: formatProtoTimestamp(goods.updatedAt),
  };
}

function mapSpotGoodsBrief(
  goods: ProtoSpotGoodsBrief,
  store: Store,
): SpotGoodsBrief {
  if (!goods.productTemplate) {
    throw new FeatureUnavailableError("spotGoods.productTemplate");
  }

  const product = mapTemplate(goods.productTemplate);
  if (product.storeId !== store.id) {
    throw new FeatureUnavailableError("spotGoods.store");
  }

  return {
    id: goods.id.toString(),
    product,
    salePriceCents: goods.salePriceCents,
    updatedAt: formatProtoTimestamp(goods.updatedAt),
    store,
  };
}

function parseStoreFilter(value: string | undefined): bigint {
  if (value === undefined || value === "0") return 0n;
  return parseInt64(value, "店铺 ID 不正确");
}

function parsePositiveInt32(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message);
  }
  return value;
}

function mapSpotGoodsDetail(goods: ProtoSpotGoodsDetail): SpotGoods {
  if (!goods.productTemplate) {
    throw new FeatureUnavailableError("spotGoods.productTemplate");
  }

  if (!goods.seller) {
    throw new FeatureUnavailableError("spotGoods.seller");
  }

  const updatedAt = formatProtoTimestamp(goods.updatedAt);
  if (!updatedAt) {
    throw new FeatureUnavailableError("spotGoods.updatedAt");
  }

  return {
    id: goods.id.toString(),
    product: mapTemplate(goods.productTemplate),
    salePriceCents: goods.salePriceCents,
    stock: goods.stock,
    sellerId: goods.seller.id.toString(),
    sellerName: goods.seller.name,
    sellerAvatarUrl: goods.seller.avatarUrl,
    updatedAt,
  };
}

function mapTemplate(template: ProductTemplate): SpotProductTemplate {
  return {
    id: template.id.toString(),
    title: template.title,
    description: template.description,
    priceCents: template.priceCents,
    storeId: template.storeId.toString(),
    mainImageUrl: template.mainImageUrl,
    barcode: template.barcode,
    updatedAt: formatProtoTimestamp(template.updatedAt),
  };
}

type TimestampInput = string | Timestamp | null;

function validateCreateSpotGoodsInput(input: CreateSpotGoodsInput) {
  const productTemplateId = parseInt64(
    input.productTemplateId,
    "商品模板 ID 不正确",
  );

  if (
    !Number.isInteger(input.salePriceCents) ||
    input.salePriceCents <= 0 ||
    input.salePriceCents > MAX_SIGNED_INT32
  ) {
    throw new ValidationError("现货售价不正确");
  }

  if (
    !Number.isInteger(input.stockTotal) ||
    input.stockTotal <= 0 ||
    input.stockTotal > MAX_SIGNED_INT32
  ) {
    throw new ValidationError("现货库存不正确");
  }

  return {
    productTemplateId,
    salePriceCents: input.salePriceCents,
    stockTotal: input.stockTotal,
    productTemplateUpdatedAt: parseTimestampInput(
      input.productTemplateUpdatedAt,
    ),
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
    throw new ValidationError("商品模板更新时间不能为空");
  }

  if (typeof input === "string") {
    return parseProtoTimestamp(input, "商品模板更新时间不正确");
  }

  return input;
}
