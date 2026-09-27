import { createClient } from "@connectrpc/connect";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { ProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb";
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb";
import { SpotGoodsPerspective } from "../gen/sast/sastshopv2/spot/v1/spot_goods_perspective_pb";
import type { SpotOrderDetail as ProtoSpotOrderDetail } from "../gen/sast/sastshopv2/spot/v1/spot_order_pb";
import type { SpotOrderBrief as ProtoSpotOrderBrief } from "../gen/sast/sastshopv2/spot/v1/spot_order_pb";
import { SpotOrderService } from "../gen/sast/sastshopv2/spot/v1/spot_order_service_pb";
import { SpotOrderStatus } from "../gen/sast/sastshopv2/spot/v1/spot_order_status_pb";
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb";
import { mapWithConcurrency } from "../concurrency";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";
import { formatProtoTimestamp, parseProtoTimestamp } from "../proto-timestamp";
import { createPageResult, type PageResult } from "../pagination";
import { listStores, type Store } from "./catalog";
import { mapPaymentBill, type PaymentBill } from "./payment-bills";

const MAX_SIGNED_INT64 = 9223372036854775807n;

export type SpotOrderPerspective = "purchaser" | "seller";
export type SpotOrderStatusValue =
  "pending_payment" | "paid" | "completed" | "cancelled" | "unknown";

export interface SpotOrder {
  id: string;
  orderNo: string;
  store: Store | null;
  productTitle: string;
  productDescription: string;
  productImageUrl: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  billId?: string;
  bill?: PaymentBill;
  seller: SpotOrderSeller | null;
  status: SpotOrderStatusValue;
  createdAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  updatedAt?: string | null;
}

export interface SpotOrderSeller {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface CreateSpotOrderInput {
  spotGoodsId: string;
  quantity: number;
  updatedAt?: TimestampInput;
}

export interface SpotOrderMutationInput {
  spotOrderId: string;
  updatedAt?: TimestampInput;
}

export async function listSpotOrders(
  options: ServiceOptions & {
    storeId?: string;
    perspective?: SpotOrderPerspective;
    status?: SpotOrderStatusValue;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<SpotOrder[]> {
  const result = await listSpotOrdersPage(options);
  return result.items;
}

export async function listSpotOrdersPage(
  options: ServiceOptions & {
    storeId?: string;
    perspective?: SpotOrderPerspective;
    status?: SpotOrderStatusValue;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PageResult<SpotOrder>> {
  const dataSource = resolveDataSource(options);
  const page = parsePositiveInteger(options.page ?? 1, "页码不正确");
  const pageSize = parsePositiveInteger(
    options.pageSize ?? 50,
    "每页数量不正确",
  );

  if (dataSource === "mock" || dataSource === "local") {
    if (options.storeId) {
      return listSpotOrdersByStorePage(options.storeId, {
        ...options,
        page,
        pageSize,
      });
    }

    const stores = await listStores(options);
    const pages = await mapWithConcurrency(stores, 4, (store) =>
      listSpotOrdersByStorePage(store.id, { ...options, page, pageSize }),
    );
    const orders = deduplicateSpotOrders(
      pages.flatMap((result) => result.items),
    );

    return createPageResult({
      items: orders,
      currentPage: page,
      pageSize,
      totalCount: pages.reduce((total, result) => total + result.totalCount, 0),
      expectedPage: page,
      feature: "listSpotOrders",
      hasMore: pages.some((result) => result.hasMore),
      maxItems: pageSize * stores.length,
      validateOffset: false,
    });
  }

  throw new FeatureUnavailableError("listSpotOrders");
}

function deduplicateSpotOrders(orders: SpotOrder[]): SpotOrder[] {
  const uniqueOrders = new Map<string, SpotOrder>();

  for (const order of orders) {
    if (!uniqueOrders.has(order.id)) uniqueOrders.set(order.id, order);
  }

  return [...uniqueOrders.values()];
}

export async function createSpotOrders(
  inputs: CreateSpotOrderInput[],
  options: ServiceOptions = {},
): Promise<SpotOrder[]> {
  const spotOrders = validateCreateSpotOrdersInput(inputs);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("createSpotOrders", () =>
      client.createSpotOrders({
        spotOrders,
      }),
    );

    return response.spotOrderDetails.map(mapSpotOrderDetail);
  }

  throw new FeatureUnavailableError("createSpotOrders");
}

export async function getSpotOrderDetail(
  id: string,
  options: ServiceOptions = {},
): Promise<SpotOrder> {
  const spotOrderId = parseInt64(id, "现货订单 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("getSpotOrderDetail", () =>
      client.getSpotOrderDetail({ spotOrderId }),
    );

    if (!response.spotOrderDetail) {
      throw new FeatureUnavailableError("getSpotOrderDetail");
    }

    return mapSpotOrderDetail(response.spotOrderDetail);
  }

  throw new FeatureUnavailableError("getSpotOrderDetail");
}

export async function getSpotOrderSellerContact(
  id: string,
  options: ServiceOptions = {},
): Promise<string> {
  const spotOrderId = parseInt64(id, "现货订单 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("getSpotOrderSellerContact", () =>
      client.getSpotOrderSellerContact({ spotOrderId }),
    );
    const openId = response.sellerFeishuOpenId.trim();

    if (!openId) {
      throw new FeatureUnavailableError("getSpotOrderSellerContact");
    }

    return openId;
  }

  throw new FeatureUnavailableError("getSpotOrderSellerContact");
}

export async function cancelSpotOrder(
  input: SpotOrderMutationInput,
  options: ServiceOptions = {},
): Promise<SpotOrder> {
  const parsedInput = validateSpotOrderMutationInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("cancelSpotOrder", () =>
      client.cancelSpotOrder(parsedInput),
    );

    if (!response.spotOrderDetail) {
      throw new FeatureUnavailableError("cancelSpotOrder");
    }

    return mapSpotOrderDetail(response.spotOrderDetail);
  }

  throw new FeatureUnavailableError("cancelSpotOrder");
}

export async function completeSpotOrder(
  input: SpotOrderMutationInput,
  options: ServiceOptions = {},
): Promise<SpotOrder> {
  const parsedInput = validateSpotOrderMutationInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      SpotOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("completeSpotOrder", () =>
      client.completeSpotOrder(parsedInput),
    );

    if (!response.spotOrderDetail) {
      throw new FeatureUnavailableError("completeSpotOrder");
    }

    return mapSpotOrderDetail(response.spotOrderDetail);
  }

  throw new FeatureUnavailableError("completeSpotOrder");
}

async function listSpotOrdersByStorePage(
  storeId: string,
  options: ServiceOptions & {
    perspective?: SpotOrderPerspective;
    status?: SpotOrderStatusValue;
    page?: number;
    pageSize?: number;
  },
): Promise<PageResult<SpotOrder>> {
  const page = parsePositiveInteger(options.page ?? 1, "页码不正确");
  const pageSize = parsePositiveInteger(
    options.pageSize ?? 50,
    "每页数量不正确",
  );
  const client = createClient(SpotOrderService, createLocalTransport(options));
  const response = await requestLocal("listSpotOrders", () =>
    client.listSpotOrder({
      storeId: parseInt64(storeId, "店铺 ID 不正确"),
      perspective: mapPerspective(options.perspective ?? "purchaser"),
      filterStatus: options.status
        ? mapStatusToProto(options.status)
        : undefined,
      page,
      pageSize,
    }),
  );
  const items = response.spotOrders.map(mapSpotOrder);

  return createPageResult({
    items,
    currentPage: response.currentPage,
    pageSize,
    totalCount: response.totalCount,
    expectedPage: page,
    feature: "listSpotOrders",
  });
}

function mapSpotOrder(order: ProtoSpotOrderBrief): SpotOrder {
  return {
    id: order.id.toString(),
    orderNo: order.orderNo,
    store: mapStore(order.store),
    productTitle: mapTemplate(order.productSnapshot).title,
    productDescription: mapTemplate(order.productSnapshot).description,
    productImageUrl: mapTemplate(order.productSnapshot).mainImageUrl,
    quantity: order.quantity,
    unitPriceCents: order.unitPriceCents,
    totalAmountCents: order.totalAmountCents,
    billId: mapOptionalId(order.billId),
    seller: null,
    status: mapStatusFromProto(order.status),
    createdAt: formatTimestamp(order.createdAt),
    paidAt: null,
    completedAt: null,
    cancelledAt: null,
  };
}

function mapSpotOrderDetail(order: ProtoSpotOrderDetail): SpotOrder {
  return {
    id: order.id.toString(),
    orderNo: order.orderNo,
    store: mapStore(order.store),
    productTitle: mapTemplate(order.productSnapshot).title,
    productDescription: mapTemplate(order.productSnapshot).description,
    productImageUrl: mapTemplate(order.productSnapshot).mainImageUrl,
    quantity: order.quantity,
    unitPriceCents: order.unitPriceCents,
    totalAmountCents: order.totalAmountCents,
    billId: mapOptionalId(order.billId),
    bill: order.bill ? mapPaymentBill(order.bill) : undefined,
    seller: mapSeller(order.seller),
    status: mapStatusFromProto(order.status),
    createdAt: formatTimestamp(order.createdAt),
    paidAt: formatTimestamp(order.paidAt),
    completedAt: formatTimestamp(order.completedAt),
    cancelledAt: formatTimestamp(order.cancelledAt),
    updatedAt: formatProtoTimestamp(order.updatedAt),
  };
}

function mapSeller(seller?: UserInfo): SpotOrderSeller | null {
  if (!seller) {
    return null;
  }

  return {
    id: seller.id.toString(),
    name: seller.name,
    avatarUrl: seller.avatarUrl,
  };
}

function mapStore(store?: ProtoStore): Store | null {
  if (!store) {
    return null;
  }

  return {
    id: store.id.toString(),
    name: store.name,
    address: store.address,
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
  };
}

function mapTemplate(template?: ProductTemplate) {
  if (!template) {
    throw new FeatureUnavailableError("spotOrder.productSnapshot");
  }

  return {
    title: template.title,
    description: template.description,
    mainImageUrl: template.mainImageUrl,
  };
}

function mapOptionalId(id: bigint): string | undefined {
  return id > 0n ? id.toString() : undefined;
}

function mapPerspective(
  perspective: SpotOrderPerspective,
): SpotGoodsPerspective {
  return perspective === "seller"
    ? SpotGoodsPerspective.SELLER
    : SpotGoodsPerspective.PURCHASER;
}

function mapStatusFromProto(status: SpotOrderStatus): SpotOrderStatusValue {
  if (status === SpotOrderStatus.PENDING_PAYMENT) return "pending_payment";
  if (status === SpotOrderStatus.PAID) return "paid";
  if (status === SpotOrderStatus.COMPLETED) return "completed";
  if (status === SpotOrderStatus.CANCELLED) return "cancelled";
  return "unknown";
}

function mapStatusToProto(
  status: SpotOrderStatusValue,
): SpotOrderStatus | undefined {
  if (status === "pending_payment") return SpotOrderStatus.PENDING_PAYMENT;
  if (status === "paid") return SpotOrderStatus.PAID;
  if (status === "completed") return SpotOrderStatus.COMPLETED;
  if (status === "cancelled") return SpotOrderStatus.CANCELLED;
  return undefined;
}

type TimestampInput = string | Timestamp | null;

function validateCreateSpotOrdersInput(inputs: CreateSpotOrderInput[]) {
  if (inputs.length === 0) {
    throw new ValidationError("现货订单不能为空");
  }

  return inputs.map((input) => {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ValidationError("现货购买数量不正确");
    }

    return {
      spotListingId: parseInt64(input.spotGoodsId, "现货商品 ID 不正确"),
      quantity: input.quantity,
      updatedAt: parseTimestampInput(input.updatedAt),
    };
  });
}

function validateSpotOrderMutationInput(input: SpotOrderMutationInput) {
  return {
    spotOrderId: parseInt64(input.spotOrderId, "现货订单 ID 不正确"),
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

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message);
  }

  return value;
}

function parseTimestampInput(input?: TimestampInput): Timestamp | undefined {
  if (!input) {
    return undefined;
  }

  if (typeof input === "string") {
    return parseProtoTimestamp(input, "现货订单更新时间不正确");
  }

  return input;
}

function formatTimestamp(timestamp?: Timestamp): string | null {
  return formatProtoTimestamp(timestamp);
}
