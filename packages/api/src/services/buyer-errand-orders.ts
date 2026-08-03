import { createClient } from "@connectrpc/connect";
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb";
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb";
import type {
  BuyerErrandOrderBrief as ProtoBuyerErrandOrderBrief,
  BuyerErrandOrderDetail as ProtoBuyerErrandOrderDetail,
  BuyerErrandOrderProductItem as ProtoBuyerErrandOrderProductItem,
} from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_pb";
import { BuyerErrandOrderService } from "../gen/sast/sastshopv2/errand/v1/buyer_errand_order_service_pb";
import { ErrandDemandStatus } from "../gen/sast/sastshopv2/errand/v1/errand_demand_status_pb";
import type { UserInfo } from "../gen/sast/sastshopv2/user/v1/user_info_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createPageResult, type PageResult } from "../pagination";
import { createLocalTransport, requestLocal } from "../local-connect";
import type { Store } from "./catalog";
import { mapPaymentBill, type PaymentBill } from "./payment-bills";
import type { ProductTemplate } from "./product-templates";

const MAX_SIGNED_INT64 = 9223372036854775807n;

export type BuyerErrandOrderStatus =
  | "open"
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "pending_payment"
  | "completed"
  | "cancelled"
  | "unknown";

export type BuyerErrandOrderStatusFilter = Exclude<
  BuyerErrandOrderStatus,
  "unknown"
>;

export interface BuyerErrandOrder {
  id: string;
  storeId: string;
  createdAt: string | null;
  store: Store | null;
  status: BuyerErrandOrderStatus;
  productTemplates: ProductTemplate[];
  totalOriginAmountCents: number;
  totalActualAmountCents: number | null;
  totalServiceFeeCents: number;
  productTotalCount: number;
}

export interface BuyerErrandOrderProductItem {
  productTemplate: ProductTemplate;
  actualUnitPriceCents: number | null;
  requiredQuantity: number;
  purchasedQuantity: number | null;
  nonPurchaseReason: string | null;
  distributedQuantity: number | null;
  serviceFeePerUnitCents: number;
  subtotalCents: number;
  demandItemId: string;
}

export interface BuyerErrandOrderCaptain {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface BuyerErrandOrderDetail {
  id: string;
  storeId: string;
  createdAt: string | null;
  updatedAt: string | null;
  store: Store | null;
  status: BuyerErrandOrderStatus;
  productItems: BuyerErrandOrderProductItem[];
  totalOriginAmountCents: number;
  totalActualAmountCents: number | null;
  totalServiceFeeCents: number;
  captain: BuyerErrandOrderCaptain | null;
  bill: PaymentBill | null;
  deadline: string | null;
  shoppingStartAt: string | null;
  shoppingCompletedAt: string | null;
  distributionCompletedAt: string | null;
  paymentCompletedAt: string | null;
  cancelledAt: string | null;
}

export async function listBuyerErrandOrders(
  options: ServiceOptions & {
    storeId?: string;
    status?: BuyerErrandOrderStatusFilter;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<BuyerErrandOrder[]> {
  const result = await listBuyerErrandOrdersPage(options);
  return result.items;
}

export async function listBuyerErrandOrdersPage(
  options: ServiceOptions & {
    storeId?: string;
    status?: BuyerErrandOrderStatusFilter;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PageResult<BuyerErrandOrder>> {
  const request = parseListBuyerErrandOrdersOptions(options);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      BuyerErrandOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("listBuyerErrandOrders", () =>
      client.getBuyerErrandOrderBrief(request),
    );

    return createPageResult({
      items: response.orders.map(mapBuyerErrandOrder),
      currentPage: response.currentPage,
      pageSize: request.pageSize,
      totalCount: response.totalCount,
      expectedPage: request.page,
      feature: "listBuyerErrandOrders",
    });
  }

  throw new FeatureUnavailableError("listBuyerErrandOrders");
}

export async function getBuyerErrandOrderDetail(
  id: string,
  options: ServiceOptions = {},
): Promise<BuyerErrandOrderDetail> {
  const errandDemandId = parseInt64(id, "跑腿订单 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      BuyerErrandOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal("getBuyerErrandOrderDetail", () =>
      client.getBuyerErrandOrderDetail({ errandDemandId }),
    );

    if (!response.order) {
      throw new FeatureUnavailableError("getBuyerErrandOrderDetail");
    }

    return mapBuyerErrandOrderDetail(response.order);
  }

  throw new FeatureUnavailableError("getBuyerErrandOrderDetail");
}

export async function getBuyerErrandOrderCaptainContact(
  id: string,
  options: ServiceOptions = {},
): Promise<string> {
  const errandDemandId = parseInt64(id, "跑腿订单 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      BuyerErrandOrderService,
      createLocalTransport(options),
    );
    const response = await requestLocal(
      "getBuyerErrandOrderCaptainContact",
      () => client.getBuyerErrandOrderCaptainContact({ errandDemandId }),
    );
    const openId = response.captainFeishuOpenId.trim();

    if (!openId) {
      throw new FeatureUnavailableError("getBuyerErrandOrderCaptainContact");
    }

    return openId;
  }

  throw new FeatureUnavailableError("getBuyerErrandOrderCaptainContact");
}

function parseListBuyerErrandOrdersOptions(options: {
  storeId?: string;
  status?: BuyerErrandOrderStatusFilter;
  page?: number;
  pageSize?: number;
}) {
  return {
    page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
    pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
    ...(options.storeId
      ? { storeIdFilter: parseInt64(options.storeId, "店铺 ID 不正确") }
      : {}),
    ...(options.status
      ? { statusFilter: parseStatusFilter(options.status) }
      : {}),
  };
}

function mapBuyerErrandOrder(
  order: ProtoBuyerErrandOrderBrief,
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
  };
}

function mapBuyerErrandOrderDetail(
  order: ProtoBuyerErrandOrderDetail,
): BuyerErrandOrderDetail {
  if (order.productItems.length === 0) {
    throw new FeatureUnavailableError("buyerErrandOrder.productItems");
  }

  return {
    id: order.errandDemandId.toString(),
    storeId: order.storeId.toString(),
    createdAt: formatTimestamp(order.createdAt),
    updatedAt: formatTimestamp(order.updatedAt),
    store: mapStore(order.storeInfo),
    status: mapStatusFromProto(order.status),
    productItems: order.productItems.map(mapBuyerErrandOrderProductItem),
    totalOriginAmountCents: order.totalOriginAmountCents,
    totalActualAmountCents: order.totalActualAmountCents ?? null,
    totalServiceFeeCents: order.totalServiceFeeCents,
    captain: mapCaptain(order.captainInfo),
    bill: order.bill ? mapPaymentBill(order.bill) : null,
    deadline: formatTimestamp(order.deadline),
    shoppingStartAt: formatTimestamp(order.shoppingStartAt),
    shoppingCompletedAt: formatTimestamp(order.shoppingCompletedAt),
    distributionCompletedAt: formatTimestamp(order.distributionCompletedAt),
    paymentCompletedAt: formatTimestamp(order.paymentCompletedAt),
    cancelledAt: formatTimestamp(order.cancelledAt),
  };
}

function mapBuyerErrandOrderProductItem(
  item: ProtoBuyerErrandOrderProductItem,
): BuyerErrandOrderProductItem {
  if (!item.productTemplate) {
    throw new FeatureUnavailableError("buyerErrandOrder.productTemplate");
  }

  return {
    productTemplate: mapProductTemplate(item.productTemplate),
    actualUnitPriceCents: item.actualUnitPriceCents ?? null,
    requiredQuantity: item.requiredQuantity,
    purchasedQuantity: item.purchasedQuantity ?? null,
    nonPurchaseReason: item.nonPurchaseReason ?? null,
    distributedQuantity: item.distributedQuantity ?? null,
    serviceFeePerUnitCents: item.serviceFeePerUnitCents,
    subtotalCents: item.subtotalCents,
    demandItemId: item.errandDemandItemId.toString(),
  };
}

function mapCaptain(user?: UserInfo): BuyerErrandOrderCaptain | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id.toString(),
    name: user.name,
    avatarUrl: user.avatarUrl,
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
  };
}

function mapStatusFromProto(
  status: ErrandDemandStatus,
): BuyerErrandOrderStatus {
  if (status === ErrandDemandStatus.OPEN) return "open";
  if (status === ErrandDemandStatus.SHOPPING) return "shopping";
  if (status === ErrandDemandStatus.PENDING_DISTRIBUTING) {
    return "pending_distributing";
  }
  if (status === ErrandDemandStatus.DISTRIBUTING) return "distributing";
  if (status === ErrandDemandStatus.PENDING_PAYMENT) return "pending_payment";
  if (status === ErrandDemandStatus.COMPLETED) return "completed";
  if (status === ErrandDemandStatus.CANCELLED) return "cancelled";
  return "unknown";
}

function parseStatusFilter(status: string): ErrandDemandStatus {
  const protoStatus = mapStatusToProto(status);

  if (protoStatus === undefined) {
    throw new ValidationError("跑腿订单状态不正确");
  }

  return protoStatus;
}

function mapStatusToProto(status: string): ErrandDemandStatus | undefined {
  if (status === "open") return ErrandDemandStatus.OPEN;
  if (status === "shopping") return ErrandDemandStatus.SHOPPING;
  if (status === "pending_distributing") {
    return ErrandDemandStatus.PENDING_DISTRIBUTING;
  }
  if (status === "distributing") return ErrandDemandStatus.DISTRIBUTING;
  if (status === "pending_payment") return ErrandDemandStatus.PENDING_PAYMENT;
  if (status === "completed") return ErrandDemandStatus.COMPLETED;
  if (status === "cancelled") return ErrandDemandStatus.CANCELLED;
  return undefined;
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

function formatTimestamp(
  timestamp: { seconds: bigint; nanos: number } | undefined,
): string | null {
  if (!timestamp) {
    return null;
  }

  return new Date(
    Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000),
  ).toISOString();
}
