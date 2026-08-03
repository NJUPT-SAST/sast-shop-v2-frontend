import { createClient } from "@connectrpc/connect";
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt";
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb";
import type { ErrandDemandByStore as ProtoErrandDemandByStore } from "../gen/sast/sastshopv2/errand/v1/errand_demand_by_store_pb";
import type { ErrandDemandDetail as ProtoErrandDemandDetail } from "../gen/sast/sastshopv2/errand/v1/errand_demand_detail_pb";
import type { ErrandDemandDetailRequester as ProtoErrandDemandDetailRequester } from "../gen/sast/sastshopv2/errand/v1/errand_demand_detail_requester_pb";
import { ErrandDemandService } from "../gen/sast/sastshopv2/errand/v1/errand_demand_service_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createPageResult, type PageResult } from "../pagination";
import { createLocalTransport, requestLocal } from "../local-connect";
import type { ProductTemplate } from "./product-templates";

const MAX_SIGNED_INT64 = 9223372036854775807n;
const MAX_SIGNED_INT32 = 2_147_483_647;

export interface CreateErrandDemandInput {
  storeId: string;
  deadline: string;
  items: Array<{
    productTemplateId: string;
    quantity: number;
    serviceFeePerUnitCents: number;
    updatedAt?: string | null;
  }>;
}

export interface CreateErrandDemandResult {
  errandDemandId: string;
}

export interface UpdateErrandDemandInput {
  errandDemandId: string;
  storeId: string;
  deadline: string;
  items: Array<{
    productTemplateId: string;
    quantity: number;
    serviceFeePerUnitCents: number;
    updatedAt?: string | null;
  }>;
  updatedAt?: string | null;
}

export interface ErrandDemandStoreSummary {
  storeId: string;
  storeName: string;
  participantAvatars: string[];
  totalOriginUnitPriceCents: number;
  totalServiceFeeCents: number;
  updatedAt: string | null;
}

export interface ErrandDemandRequester {
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  quantity: number;
  serviceFeePerUnitCents: number;
  errandDemandItemId: string;
  deadline: string | null;
  updatedAt: string | null;
}

export interface ErrandDemandDetailGroup {
  errandDemandId: string;
  productTemplate: ProductTemplate;
  estimatedUnitPriceCents: number;
  quantity: number;
  requesters: ErrandDemandRequester[];
}

export async function createErrandDemand(
  input: CreateErrandDemandInput,
  options: ServiceOptions = {},
): Promise<CreateErrandDemandResult> {
  const request = parseCreateErrandDemandInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    // remote线上远程环境暂未实现，走else分支
    const client = createClient(
      //基于 Service 定义 + transport，生成 RPC 风格客户端；
      ErrandDemandService,
      createLocalTransport(options),
    );
    const response = await requestLocal("createErrandDemand", () =>
      // requestLocal 内部合适时机再执行这个回调发起请求；
      client.createErrandDemand(request),
    );

    return { errandDemandId: response.errandDemandId.toString() };
  }

  throw new FeatureUnavailableError("createErrandDemand");
}

export async function updateErrandDemand(
  input: UpdateErrandDemandInput,
  options: ServiceOptions = {},
): Promise<void> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandDemandService,
      createLocalTransport(options),
    );
    const updatedAt = parseOptionalTimestamp(
      input.updatedAt,
      "更新时间不正确",
    );
    await requestLocal("updateErrandDemand", () =>
      client.updateErrandDemand({
        errandDemandId: parseInt64(
          input.errandDemandId,
          "跑腿订单 ID 不正确",
        ),
        storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
        deadline: parseRequiredTimestamp(
          input.deadline,
          "期望送达时间不正确",
        ),
        demandItems: input.items.map((item) => {
          const itemUpdatedAt = parseOptionalTimestamp(
            item.updatedAt,
            "商品更新时间不正确",
          );
          return {
            productTemplateId: parseInt64(
              item.productTemplateId,
              "商品模板 ID 不正确",
            ),
            quantity: parsePositiveInteger(
              item.quantity,
              "跑腿需求数量不正确",
            ),
            serviceFeePerUnitCents: parseNonNegativeInteger(
              item.serviceFeePerUnitCents,
              "跑腿费不正确",
            ),
            ...(itemUpdatedAt ? { updatedAt: itemUpdatedAt } : {}),
          };
        }),
        ...(updatedAt ? { updatedAt } : {}),
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("updateErrandDemand");
}

export async function cancelErrandDemand(
  errandDemandId: string,
  options: ServiceOptions & { updatedAt?: string | null } = {},
): Promise<void> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandDemandService,
      createLocalTransport(options),
    );
    const updatedAt = parseOptionalTimestamp(
      options.updatedAt,
      "更新时间不正确",
    );
    await requestLocal("cancelErrandDemand", () =>
      client.cancelErrandDemand({
        errandDemandId: parseInt64(
          errandDemandId,
          "跑腿订单 ID 不正确",
        ),
        ...(updatedAt ? { updatedAt } : {}),
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("cancelErrandDemand");
}

export async function listErrandDemandStores(
  options: ServiceOptions & {
    storeName?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ErrandDemandStoreSummary[]> {
  const result = await listErrandDemandStoresPage(options);
  return result.items;
}

export async function listErrandDemandStoresPage(
  options: ServiceOptions & {
    storeName?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PageResult<ErrandDemandStoreSummary>> {
  const page = parsePositiveInteger(options.page ?? 1, "页码不正确");
  const pageSize = parsePositiveInteger(
    options.pageSize ?? 50,
    "每页数量不正确",
  );
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandDemandService,
      createLocalTransport(options),
    );
    const response = await requestLocal("listErrandDemandStores", () =>
      client.getDemandList({
        page,
        pageSize,
        ...(options.storeName?.trim()
          ? { storeName: options.storeName.trim() }
          : {}),
      }),
    );

    return createPageResult({
      items: response.demands.map(mapErrandDemandStore),
      currentPage: response.currentPage,
      pageSize,
      totalCount: response.totalCount,
      expectedPage: page,
      feature: "listErrandDemandStores",
    });
  }

  throw new FeatureUnavailableError("listErrandDemandStores");
}

export async function getErrandDemandDetails(
  input: { storeId: string },
  options: ServiceOptions = {},
): Promise<ErrandDemandDetailGroup[]> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandDemandService,
      createLocalTransport(options),
    );
    const response = await requestLocal("getErrandDemandDetails", () =>
      client.getDemandDetail({
        storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
      }),
    );

    return response.details.map(mapErrandDemandDetail);
  }

  throw new FeatureUnavailableError("getErrandDemandDetails");
}

function parseCreateErrandDemandInput(input: CreateErrandDemandInput) {
  if (input.items.length === 0) {
    throw new ValidationError("跑腿需求商品不能为空");
  }

  return {
    storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
    deadline: parseRequiredTimestamp(input.deadline, "期望送达时间不正确"),
    demandItems: input.items.map((item) => {
      const updatedAt = parseOptionalTimestamp(
        item.updatedAt,
        "商品更新时间不正确",
      );

      return {
        productTemplateId: parseInt64(
          item.productTemplateId,
          "商品模板 ID 不正确",
        ),
        quantity: parsePositiveInteger(item.quantity, "跑腿需求数量不正确"),
        serviceFeePerUnitCents: parseNonNegativeInteger(
          item.serviceFeePerUnitCents,
          "跑腿费不正确",
        ),
        ...(updatedAt ? { updatedAt } : {}),
      };
    }),
  };
}

function mapErrandDemandStore(
  demand: ProtoErrandDemandByStore,
): ErrandDemandStoreSummary {
  return {
    storeId: demand.storeId.toString(),
    storeName: demand.storeName,
    participantAvatars: demand.participantAvatars,
    totalOriginUnitPriceCents: demand.totalOriginUnitPriceCents,
    totalServiceFeeCents: demand.totalServiceFeeCents,
    updatedAt: formatTimestamp(demand.updatedAt),
  };
}

function mapErrandDemandDetail(
  detail: ProtoErrandDemandDetail,
): ErrandDemandDetailGroup {
  const productTemplate = mapProductTemplate(detail.productTemplate);
  if (!productTemplate) {
    throw new FeatureUnavailableError("errandDemand.productTemplate");
  }

  return {
    errandDemandId: detail.errandDemandId.toString(),
    productTemplate,
    estimatedUnitPriceCents: detail.estimatedUnitPriceCents,
    quantity: detail.quantity,
    requesters: detail.requesters.map(mapErrandDemandRequester),
  };
}

function mapErrandDemandRequester(
  requester: ProtoErrandDemandDetailRequester,
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
  };
}

function mapProductTemplate(
  template: ProtoProductTemplate | undefined,
): ProductTemplate | null {
  if (!template) {
    return null;
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
  };
}

function formatTimestamp(timestamp: Timestamp | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  return timestampDate(timestamp).toISOString();
}
// 解释字符串形式的数字ID
//校验并转换为符合有符号 64 位整型（int64 signed）规范的 bigint；
// 常用于解析数据库主键（MySQL BIGINT、Postgres bigint），杜绝 JS Number 浮点数精度丢失问题。
function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    /*^ 字符串开头，$ 字符串结尾（整串匹配，不能有多余字符）
[1-9] 第一位必须是 1~9：不能以 0 开头，排除 00123、0、056 这类非法 ID
\d* 后面可以跟任意数字（0 个或多个） */
    throw new ValidationError(message);
  }

  const parsed = BigInt(value);

  if (parsed > MAX_SIGNED_INT64) {
    throw new ValidationError(message);
  }

  return parsed;
}

function parseRequiredTimestamp(value: string, message: string): Timestamp {
  return parseTimestamp(value, message);
}

function parseOptionalTimestamp(
  value: string | null | undefined,
  message: string,
): Timestamp | undefined {
  if (!value) {
    return undefined;
  }

  return parseTimestamp(value, message);
}

function parseTimestamp(value: string, message: string): Timestamp {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message);
  }

  return timestampFromDate(date);
}

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message);
  }

  return value;
}

function parseNonNegativeInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message);
  }

  return value;
}
