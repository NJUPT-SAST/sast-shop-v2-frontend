import { createClient } from "@connectrpc/connect";
import {
  timestampDate,
  timestampFromDate,
  type Timestamp,
} from "@bufbuild/protobuf/wkt";
import type { ErrandTask as ProtoErrandTask } from "../gen/sast/sastshopv2/errand/v1/errand_task_pb";
import { ErrandTaskService } from "../gen/sast/sastshopv2/errand/v1/errand_task_service_pb";
import { ErrandTaskStatus } from "../gen/sast/sastshopv2/errand/v1/errand_task_status_pb";
import type { ErrandTaskItem } from "../gen/sast/sastshopv2/errand/v1/errand_task_item_pb";
import type { DistributingItem } from "../gen/sast/sastshopv2/errand/v1/distributing_item_pb";
import type { DistributingRequestInfo } from "../gen/sast/sastshopv2/errand/v1/distributing_request_info_pb";
import type { CollectingPaymentBillDetail } from "../gen/sast/sastshopv2/errand/v1/collecting_payment_bill_pb";
import type { CollectingPaymentRequesterItemDetail } from "../gen/sast/sastshopv2/errand/v1/collecting_payment_requester_item_pb";
import { BillStatus } from "../gen/sast/sastshopv2/payment/v1/bill_pb";
import { Channel } from "../gen/sast/sastshopv2/payment/v1/channel_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createPageResult, type PageResult } from "../pagination";
import { createLocalTransport, requestLocal } from "../local-connect";

const MAX_SIGNED_INT64 = 9223372036854775807n;
const MAX_SIGNED_INT32 = 2_147_483_647;

export type ErrandTaskStatusValue =
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "collecting_payment"
  | "completed"
  | "cancelled"
  | "unknown";

export type ErrandTaskStatusFilter = Exclude<ErrandTaskStatusValue, "unknown">;

export interface CreateErrandTaskInput {
  storeId: string;
  demandItems: Array<{
    errandDemandItemId: string;
    updatedAt?: string | null;
  }>;
}

export interface CreateErrandTaskResult {
  errandTaskId: string;
}

export interface ErrandTaskBrief {
  id: string;
  storeId: string;
  storeName: string;
  status: ErrandTaskStatusValue;
  itemCount: number;
  items: ErrandTaskBriefItem[];
  updatedAt: string | null;
  createdAt: string | null;
}

export interface ErrandTaskBriefItem {
  id: string;
  updatedAt: string | null;
}

type ListErrandTasksOptions = ServiceOptions & {
  page?: number;
  pageSize?: number;
  status?: ErrandTaskStatusFilter;
};

export async function createErrandTask(
  input: CreateErrandTaskInput,
  options: ServiceOptions = {},
): Promise<CreateErrandTaskResult> {
  const request = parseCreateErrandTaskInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    const response = await requestLocal("createErrandTask", () =>
      client.createTask(request),
    );

    return { errandTaskId: response.errandTaskId.toString() };
  }

  throw new FeatureUnavailableError("createErrandTask");
}

export async function listErrandTasks(
  options: ListErrandTasksOptions = {},
): Promise<ErrandTaskBrief[]> {
  const result = await listErrandTasksPage(options);
  return result.items;
}

export async function listErrandTasksPage(
  options: ListErrandTasksOptions = {},
): Promise<PageResult<ErrandTaskBrief>> {
  const request = {
    page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
    pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
    ...(options.status
      ? { filterStatus: mapStatusToProto(options.status) }
      : {}),
  };
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    let rawErrandTasks: unknown[] = [];
    const client = createClient(
      ErrandTaskService,
      createLocalTransport({
        ...options,
        fetch: createErrandTaskListCaptureFetch(options, (tasks) => {
          rawErrandTasks = tasks;
        }),
      }),
    );
    const response = await requestLocal("listErrandTasks", () =>
      client.getErrandTaskList(request),
    );

    return createPageResult({
      items: response.errandTasks.map((task, index) =>
        mapErrandTask(task, rawErrandTasks[index]),
      ),
      currentPage: response.currentPage,
      pageSize: request.pageSize,
      totalCount: response.totalCount,
      expectedPage: request.page,
      feature: "listErrandTasks",
    });
  }

  throw new FeatureUnavailableError("listErrandTasks");
}

export async function getErrandTaskBrief(
  taskId: string,
  options: ServiceOptions = {},
): Promise<ErrandTaskBrief | null> {
  const normalizedTaskId = parseInt64(taskId, "任务 ID 不正确").toString();
  const pageSize = 50;
  let page = 1;

  while (true) {
    const result = await listErrandTasksPage({ ...options, page, pageSize });
    const task = result.items.find((item) => item.id === normalizedTaskId);

    if (task) return task;
    if (page * pageSize >= result.totalCount) return null;

    page += 1;
  }
}

function parseCreateErrandTaskInput(input: CreateErrandTaskInput) {
  if (input.demandItems.length === 0) {
    throw new ValidationError("跑腿任务商品不能为空");
  }

  return {
    storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
    demandItems: input.demandItems.map((item) => {
      const updatedAt = parseOptionalTimestamp(
        item.updatedAt,
        "商品更新时间不正确",
      );

      return {
        errandDemandItemId: parseInt64(
          item.errandDemandItemId,
          "跑腿需求商品 ID 不正确",
        ),
        ...(updatedAt ? { updatedAt } : {}),
      };
    }),
  };
}

function mapErrandTask(
  task: ProtoErrandTask,
  rawTask?: unknown,
): ErrandTaskBrief {
  const items = task.items.map(mapErrandTaskBriefItem);

  return {
    id: task.taskId.toString(),
    storeId: task.storeId.toString(),
    storeName: task.storeName,
    status: mapStatusFromProto(task.status),
    itemCount: items.length,
    items,
    updatedAt: mapErrandTaskUpdatedAt(task, rawTask),
    createdAt: formatTimestamp(task.createdAt),
  };
}

function mapErrandTaskUpdatedAt(
  task: ProtoErrandTask,
  rawTask?: unknown,
): string | null {
  const rawUpdatedAt = getRawUpdatedAt(rawTask);

  if (rawUpdatedAt) {
    return rawUpdatedAt;
  }

  const taskWithUpdatedAt = task as ProtoErrandTask & {
    updatedAt?: Timestamp | undefined;
  };

  return formatTimestamp(taskWithUpdatedAt.updatedAt);
}

function createErrandTaskListCaptureFetch(
  options: ServiceOptions,
  onTasks: (tasks: unknown[]) => void,
): typeof globalThis.fetch {
  return createJsonBodyCaptureFetch(options, (body) => {
    const tasks = getRawRepeatedField(body, "errandTasks", "errand_tasks");

    if (tasks) {
      onTasks(tasks);
    }
  });
}

function createJsonBodyCaptureFetch(
  options: ServiceOptions,
  onBody: (body: unknown) => void,
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = options.fetch
      ? await options.fetch(input, init)
      : await globalThis.fetch(input, init);

    try {
      const body: unknown = await response.clone().json();
      onBody(body);
    } catch {
      // Non-JSON Connect responses are still parsed by the generated client.
    }

    return response;
  };
}

function getRawUpdatedAt(value: unknown): string | null {
  return (
    getRawTimestampString(value, "updatedAt") ??
    getRawTimestampString(value, "updated_at")
  );
}

function getRawRepeatedField(
  value: unknown,
  jsonName: string,
  protoName: string,
): unknown[] | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawValue = value[jsonName] ?? value[protoName];

  return Array.isArray(rawValue) ? rawValue : null;
}

function getRawTimestampString(
  value: unknown,
  fieldName: string,
): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawValue = value[fieldName];

  if (typeof rawValue !== "string") {
    return null;
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapResponseUpdatedAt(
  response: unknown,
  rawResponse?: unknown,
): string | null {
  const responseWithUpdatedAt = response as {
    updatedAt?: Timestamp | undefined;
  };

  return (
    getRawUpdatedAt(rawResponse) ??
    formatTimestamp(responseWithUpdatedAt.updatedAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapErrandTaskBriefItem(item: ErrandTaskItem): ErrandTaskBriefItem {
  return {
    id: item.id.toString(),
    updatedAt: formatTimestamp(item.updatedAt),
  };
}

function mapStatusFromProto(status: ErrandTaskStatus): ErrandTaskStatusValue {
  if (status === ErrandTaskStatus.SHOPPING) return "shopping";
  if (status === ErrandTaskStatus.PENDING_DISTRIBUTING) {
    return "pending_distributing";
  }
  if (status === ErrandTaskStatus.DISTRIBUTING) return "distributing";
  if (status === ErrandTaskStatus.COLLECTING_PAYMENT) {
    return "collecting_payment";
  }
  if (status === ErrandTaskStatus.COMPLETED) return "completed";
  if (status === ErrandTaskStatus.CANCELLED) return "cancelled";
  return "unknown";
}

function mapStatusToProto(status: ErrandTaskStatusFilter): ErrandTaskStatus {
  if (status === "shopping") return ErrandTaskStatus.SHOPPING;
  if (status === "pending_distributing") {
    return ErrandTaskStatus.PENDING_DISTRIBUTING;
  }
  if (status === "distributing") return ErrandTaskStatus.DISTRIBUTING;
  if (status === "collecting_payment") {
    return ErrandTaskStatus.COLLECTING_PAYMENT;
  }
  if (status === "completed") return ErrandTaskStatus.COMPLETED;
  if (status === "cancelled") return ErrandTaskStatus.CANCELLED;

  throw new ValidationError("跑腿任务状态不正确");
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

function parseOperationQuantity(value: number, message: string): number {
  if (!Number.isInteger(value) || value < -1 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message);
  }

  return value;
}

function parseNonNegativeInt32(value: number, message: string): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message);
  }

  return value;
}

function parseOptionalTimestamp(
  value: string | null | undefined,
  message: string,
): Timestamp | undefined {
  if (value == null) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message);
  }

  return timestampFromDate(date);
}

function formatTimestamp(timestamp: Timestamp | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  return timestampDate(timestamp).toISOString();
}

function parseOptionalTimestampString(
  value: string | null | undefined,
  message: string,
): Timestamp | undefined {
  if (value == null) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message);
  }

  return timestampFromDate(date);
}

function parseTimestampString(value: string, message: string): Timestamp {
  if (!value) {
    throw new ValidationError(message);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(message);
  }

  return timestampFromDate(date);
}

export interface ShoppingTaskItem {
  id: string;
  productTitle: string;
  productDescription: string;
  productImageUrl: string;
  productBarcode: string;
  requiredQuantity: number;
  purchasedQuantity: number | null;
  nonPurchaseReason: string | null;
  actualUnitPriceCents: number;
  updatedAt: string | null;
}

export interface ShoppingTaskDetail {
  taskId: string;
  storeId: string;
  storeName: string;
  taskUpdatedAt: string | null;
  taskItems: ShoppingTaskItem[];
}

export interface DistributingRequester {
  purchaserId: string;
  purchaserName: string;
  purchaserAvatarUrl: string;
  quantity: number;
  distributedQuantity: number;
  errandTaskAssignmentId: string;
  errandDemandItemId: string;
  assignmentUpdatedAt: string | null;
}

export interface DistributingTaskItem {
  errandTaskItemId: string;
  title: string;
  description: string;
  imageUrl: string;
  originUnitPriceCents: number;
  actualUnitPriceCents: number;
  itemUpdatedAt: string | null;
  requesters: DistributingRequester[];
}

export interface DistributingTaskDetail {
  taskId: string;
  storeId: string;
  storeName: string;
  taskUpdatedAt: string | null;
  packagingFeeCents: number;
  items: DistributingTaskItem[];
}

type GetDistributingTaskDetailOptions = ServiceOptions & {
  taskItems?: ErrandTaskBriefItem[];
  taskUpdatedAt?: string | null;
};

export interface CollectingPaymentItem {
  errandDemandItemId: string;
  title: string;
  requiredQuantity: number;
  purchasedQuantity: number;
  distributedQuantity: number;
  actualUnitPriceCents: number;
  productAmountCents: number;
  serviceFeePerUnitCents: number;
  serviceFeeAmountCents: number;
  packagingFeeShareCents: number;
  subtotalCents: number;
  nonPurchaseReason: string | null;
}

export interface CollectingPaymentBill {
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string;
  paymentStatus:
    "pending" | "pending_confirmation" | "confirmed" | "closed" | "unknown";
  billId: string | null;
  billNo: string | null;
  billUpdatedAt: string | null;
  paymentChannel: "wechat" | "alipay" | null;
  serialNumber: string | null;
  verifyCode: string | null;
  items: CollectingPaymentItem[];
  productAmountCents: number;
  serviceFeeAmountCents: number;
  packagingFeeShareCents: number;
  totalAmountCents: number;
}

export interface CollectingPaymentDetail {
  taskId: string;
  taskUpdatedAt: string | null;
  bills: CollectingPaymentBill[];
}

export interface SaveShoppingItemInput {
  errandTaskId: string;
  errandTaskItemId: string;
  purchasedQuantity: number;
  nonPurchaseReason?: string | null;
  itemUpdatedAt?: string | null;
}

export interface SaveDistributingAssignmentInput {
  errandTaskItemId: string;
  errandTaskAssignmentId: string;
  distributedQuantity: number;
  assignmentUpdatedAt?: string | null;
}

export interface SaveDistributingAssignmentResult {
  assignmentUpdatedAt: string | null;
}

export interface UpdateActualPriceInput {
  errandTaskId: string;
  errandTaskItemId: string;
  actualUnitPriceCents: number;
  itemUpdatedAt?: string | null;
}

export async function getShoppingTaskDetail(
  taskId: string,
  options: ServiceOptions = {},
): Promise<ShoppingTaskDetail> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    let rawDetail: unknown = null;
    const client = createClient(
      ErrandTaskService,
      createLocalTransport({
        ...options,
        fetch: createJsonBodyCaptureFetch(options, (body) => {
          rawDetail = body;
        }),
      }),
    );
    const response = await requestLocal("getShoppingTaskDetail", () =>
      client.getShoppingTaskDetail({ errandTaskId }),
    );

    return {
      taskId: response.errandTaskId.toString(),
      storeId: response.storeId.toString(),
      storeName: response.storeName,
      taskUpdatedAt: mapResponseUpdatedAt(response, rawDetail),
      taskItems: response.taskItems.map(mapErrandTaskItem),
    };
  }

  throw new FeatureUnavailableError("getShoppingTaskDetail");
}

export async function saveShoppingTaskItem(
  input: SaveShoppingItemInput,
  options: ServiceOptions = {},
): Promise<void> {
  const dataSource = resolveDataSource(options);
  const purchasedQuantity = parseOperationQuantity(
    input.purchasedQuantity,
    "采购数量不正确",
  );

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("saveShoppingTaskItem", () =>
      client.saveShoppingTaskItem({
        errandTaskId: parseInt64(input.errandTaskId, "跑腿任务 ID 不正确"),
        errandTaskItemId: parseInt64(
          input.errandTaskItemId,
          "任务商品 ID 不正确",
        ),
        purchasedQuantity,
        ...(input.nonPurchaseReason != null
          ? { nonPurchaseReason: input.nonPurchaseReason }
          : {}),
        ...(input.itemUpdatedAt != null
          ? {
              errandTaskItemUpdatedAt: parseOptionalTimestampString(
                input.itemUpdatedAt,
                "商品更新时间不正确",
              ),
            }
          : {}),
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("saveShoppingTaskItem");
}

export async function transitionToPendingDistributing(
  taskId: string,
  _updatedAt?: string | null,
  options: ServiceOptions = {},
): Promise<void> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("transitionToPendingDistributing", () =>
      client.transitionToPendingDistributing({
        errandTaskId,
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("transitionToPendingDistributing");
}

export async function getDistributingTaskDetail(
  taskId: string,
  options: GetDistributingTaskDetailOptions = {},
): Promise<DistributingTaskDetail> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const concurrencyInfo = await getErrandTaskConcurrencyInfo(
      errandTaskId.toString(),
      options,
    );
    let rawDetail: unknown = null;
    const client = createClient(
      ErrandTaskService,
      createLocalTransport({
        ...options,
        fetch: createJsonBodyCaptureFetch(options, (body) => {
          rawDetail = body;
        }),
      }),
    );
    const response = await requestLocal("getDistributingTaskDetail", () =>
      client.getDistributingTaskDetail({ errandTaskId }),
    );
    const detailUpdatedAt = mapResponseUpdatedAt(response, rawDetail);

    const finalTaskUpdatedAt = detailUpdatedAt ?? concurrencyInfo.taskUpdatedAt;
    const mappedItems = response.distributingItems.map((item) =>
      mapDistributingItem(item, concurrencyInfo.itemUpdatedAtById),
    );

    return {
      taskId: response.errandTaskId.toString(),
      storeId: response.storeId.toString(),
      storeName: response.storeName,
      taskUpdatedAt: finalTaskUpdatedAt,
      packagingFeeCents: response.packagingFeeCents,
      items: mappedItems,
    };
  }

  throw new FeatureUnavailableError("getDistributingTaskDetail");
}

export async function updateActualPrice(
  input: UpdateActualPriceInput,
  options: ServiceOptions = {},
): Promise<void> {
  const dataSource = resolveDataSource(options);
  const actualUnitPriceCents = parseNonNegativeInt32(
    input.actualUnitPriceCents,
    "实际单价不正确",
  );

  if (dataSource === "mock" || dataSource === "local") {
    const errandTaskItemId = parseInt64(
      input.errandTaskItemId,
      "任务商品 ID 不正确",
    );
    const resolvedItemUpdatedAt = await resolveErrandTaskItemUpdatedAt(
      input.errandTaskId,
      errandTaskItemId.toString(),
      input.itemUpdatedAt,
      options,
    );
    const errandTaskItemUpdatedAt = parseTimestampString(
      resolvedItemUpdatedAt ?? "",
      "商品更新时间不正确",
    );
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("updateActualPrice", () =>
      client.updateActualPrice({
        errandTaskId: parseInt64(input.errandTaskId, "跑腿任务 ID 不正确"),
        errandTaskItemId,
        actualUnitPriceCents,
        errandTaskItemUpdatedAt,
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("updateActualPrice");
}

export async function transitionToDistributing(
  taskId: string,
  packagingFeeCents: number,
  updatedAt?: string | null,
  options: ServiceOptions = {},
): Promise<void> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);
  const normalizedPackagingFeeCents = parseNonNegativeInt32(
    packagingFeeCents,
    "包装费不正确",
  );

  if (dataSource === "mock" || dataSource === "local") {
    const resolvedUpdatedAt = await resolveErrandTaskUpdatedAt(
      errandTaskId.toString(),
      updatedAt,
      options,
    );
    const parsedUpdatedAt = parseTimestampString(
      resolvedUpdatedAt ?? "",
      "更新时间不正确",
    );
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("transitionToDistributing", () =>
      client.transitionToDistributing({
        errandTaskId,
        packagingFeeCents: normalizedPackagingFeeCents,
        updatedAt: parsedUpdatedAt,
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("transitionToDistributing");
}

export async function saveDistributingAssignment(
  input: SaveDistributingAssignmentInput,
  options: ServiceOptions = {},
): Promise<SaveDistributingAssignmentResult> {
  const dataSource = resolveDataSource(options);
  const distributedQuantity = parseOperationQuantity(
    input.distributedQuantity,
    "分发数量不正确",
  );

  if (dataSource === "mock" || dataSource === "local") {
    let rawResponse: unknown = null;
    const client = createClient(
      ErrandTaskService,
      createLocalTransport({
        ...options,
        fetch: createJsonBodyCaptureFetch(options, (body) => {
          rawResponse = body;
        }),
      }),
    );
    const response = await requestLocal("saveDistributingAssignment", () =>
      client.saveDistributingTaskAssignment({
        errandTaskItemId: parseInt64(
          input.errandTaskItemId,
          "任务商品 ID 不正确",
        ),
        errandTaskAssignmentId: parseInt64(
          input.errandTaskAssignmentId,
          "分发明细 ID 不正确",
        ),
        distributedQuantity,
        ...(input.assignmentUpdatedAt != null
          ? {
              errandTaskAssignmentUpdatedAt: parseOptionalTimestampString(
                input.assignmentUpdatedAt,
                "分发明细更新时间不正确",
              ),
            }
          : {}),
      }),
    );
    const responseWithUpdatedAt = response as typeof response & {
      errandTaskAssignmentUpdatedAt?: Timestamp | undefined;
    };

    return {
      assignmentUpdatedAt:
        getRawTimestampString(rawResponse, "errandTaskAssignmentUpdatedAt") ??
        getRawTimestampString(
          rawResponse,
          "errand_task_assignment_updated_at",
        ) ??
        formatTimestamp(responseWithUpdatedAt.errandTaskAssignmentUpdatedAt),
    };
  }

  throw new FeatureUnavailableError("saveDistributingAssignment");
}

export async function transitionToCollectingPayment(
  taskId: string,
  updatedAt?: string | null,
  options: ServiceOptions = {},
): Promise<void> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const resolvedUpdatedAt = await resolveErrandTaskUpdatedAt(
      errandTaskId.toString(),
      updatedAt,
      options,
    );
    const parsedUpdatedAt = parseTimestampString(
      resolvedUpdatedAt ?? "",
      "更新时间不正确",
    );
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("transitionToCollectingPayment", () =>
      client.transitionToCollectingPayment({
        errandTaskId,
        updatedAt: parsedUpdatedAt,
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("transitionToCollectingPayment");
}

export async function getCollectingPaymentDetail(
  taskId: string,
  options: ServiceOptions = {},
): Promise<CollectingPaymentDetail> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    let rawDetail: unknown = null;
    const client = createClient(
      ErrandTaskService,
      createLocalTransport({
        ...options,
        fetch: createJsonBodyCaptureFetch(options, (body) => {
          rawDetail = body;
        }),
      }),
    );
    const response = await requestLocal("getCollectingPaymentDetail", () =>
      client.getCollectingPaymentDetail({ errandTaskId }),
    );

    return {
      taskId,
      taskUpdatedAt: mapResponseUpdatedAt(response, rawDetail),
      bills: response.bills.map(mapCollectingPaymentBill),
    };
  }

  throw new FeatureUnavailableError("getCollectingPaymentDetail");
}

export async function transitionToCompleted(
  taskId: string,
  updatedAt?: string | null,
  options: ServiceOptions = {},
): Promise<void> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const resolvedUpdatedAt = await resolveErrandTaskUpdatedAt(
      errandTaskId.toString(),
      updatedAt,
      options,
    );
    const parsedUpdatedAt = parseTimestampString(
      resolvedUpdatedAt ?? "",
      "更新时间不正确",
    );
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("transitionToCompleted", () =>
      client.transitionToCompleted({
        errandTaskId,
        updatedAt: parsedUpdatedAt,
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("transitionToCompleted");
}

export async function cancelTask(
  taskId: string,
  updatedAt?: string | null,
  options: ServiceOptions = {},
): Promise<void> {
  const errandTaskId = parseInt64(taskId, "跑腿任务 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const resolvedUpdatedAt = await resolveErrandTaskUpdatedAt(
      errandTaskId.toString(),
      updatedAt,
      options,
    );
    const parsedUpdatedAt = parseTimestampString(
      resolvedUpdatedAt ?? "",
      "更新时间不正确",
    );
    const client = createClient(
      ErrandTaskService,
      createLocalTransport(options),
    );
    await requestLocal("cancelTask", () =>
      client.cancelTask({
        errandTaskId,
        updatedAt: parsedUpdatedAt,
      }),
    );
    return;
  }

  throw new FeatureUnavailableError("cancelTask");
}

function mapErrandTaskItem(item: ErrandTaskItem): ShoppingTaskItem {
  return {
    id: item.id.toString(),
    productTitle: item.productSnapshot?.title ?? "",
    productDescription: item.productSnapshot?.description ?? "",
    productImageUrl: item.productSnapshot?.mainImageUrl ?? "",
    productBarcode: item.productSnapshot?.barcode ?? "",
    requiredQuantity: item.requiredQuantity,
    purchasedQuantity:
      item.purchasedQuantity == null || item.purchasedQuantity === -1
        ? null
        : item.purchasedQuantity,
    nonPurchaseReason: item.nonPurchaseReason ?? null,
    actualUnitPriceCents: item.actualUnitPriceCents,
    updatedAt: formatTimestamp(item.updatedAt),
  };
}

async function getErrandTaskConcurrencyInfo(
  taskId: string,
  options: GetDistributingTaskDetailOptions,
): Promise<{
  taskUpdatedAt: string | null;
  itemUpdatedAtById: Map<string, string | null>;
}> {
  if (options.taskItems && options.taskUpdatedAt != null) {
    const itemMap = new Map(
      options.taskItems.map((item) => [item.id, item.updatedAt] as const),
    );
    return { taskUpdatedAt: options.taskUpdatedAt, itemUpdatedAtById: itemMap };
  }

  let task: ErrandTaskBrief | null = null;

  try {
    task = await getErrandTaskBrief(taskId, options);
  } catch {
    return { taskUpdatedAt: null, itemUpdatedAtById: new Map() };
  }

  const result = {
    taskUpdatedAt: options.taskUpdatedAt ?? task?.updatedAt ?? null,
    itemUpdatedAtById: new Map(
      options.taskItems?.map((item) => [item.id, item.updatedAt] as const) ??
        task?.items.map((item) => [item.id, item.updatedAt] as const) ??
        [],
    ),
  };
  return result;
}

async function resolveErrandTaskUpdatedAt(
  taskId: string,
  updatedAt: string | null | undefined,
  options: ServiceOptions,
): Promise<string | null> {
  if (updatedAt != null) {
    return updatedAt;
  }

  const task = await getErrandTaskBrief(taskId, options);
  return task?.updatedAt ?? null;
}

async function resolveErrandTaskItemUpdatedAt(
  taskId: string,
  taskItemId: string,
  updatedAt: string | null | undefined,
  options: ServiceOptions,
): Promise<string | null> {
  if (updatedAt != null) {
    return updatedAt;
  }

  const task = await getErrandTaskBrief(taskId, options);
  return task?.items.find((item) => item.id === taskItemId)?.updatedAt ?? null;
}

function mapDistributingRequester(
  r: DistributingRequestInfo,
): DistributingRequester {
  return {
    purchaserId: r.purchaserId.toString(),
    purchaserName: r.purchaserName,
    purchaserAvatarUrl: r.purchaserAvatarUrl,
    quantity: r.quantity,
    distributedQuantity: r.distributedQuantity,
    errandTaskAssignmentId: r.errandTaskAssignmentId.toString(),
    errandDemandItemId: r.errandDemandItemId.toString(),
    assignmentUpdatedAt: formatTimestamp(r.errandTaskAssignmentUpdatedAt),
  };
}

function mapDistributingItem(
  item: DistributingItem,
  itemUpdatedAtById: ReadonlyMap<string, string | null>,
): DistributingTaskItem {
  const errandTaskItemId = item.errandTaskItemId.toString();

  return {
    errandTaskItemId,
    title: item.titleSnapshot,
    description: item.descriptionSnapshot,
    imageUrl: item.imageUrlSnapshot,
    originUnitPriceCents: item.originUnitPriceCents,
    actualUnitPriceCents: item.actualUnitPriceCents,
    itemUpdatedAt: itemUpdatedAtById.get(errandTaskItemId) ?? null,
    requesters: item.requesters.map(mapDistributingRequester),
  };
}

function mapCollectingPaymentItem(
  item: CollectingPaymentRequesterItemDetail,
): CollectingPaymentItem {
  return {
    errandDemandItemId: item.errandDemandItemId.toString(),
    title: item.titleSnapshot,
    requiredQuantity: item.requiredQuantity,
    purchasedQuantity: item.purchasedQuantity,
    distributedQuantity: item.distributedQuantity,
    actualUnitPriceCents: item.actualUnitPriceCents,
    productAmountCents: item.productAmountCents,
    serviceFeePerUnitCents: item.serviceFeePerUnitCents,
    serviceFeeAmountCents: item.serviceFeeAmountCents,
    packagingFeeShareCents: item.packagingFeeShareCents,
    subtotalCents: item.subtotalCents,
    nonPurchaseReason: item.nonPurchaseReason ?? null,
  };
}

function mapBillStatus(
  status: BillStatus,
): CollectingPaymentBill["paymentStatus"] {
  if (status === BillStatus.UNPAID) return "pending";
  if (status === BillStatus.SUBMITTED) return "pending_confirmation";
  if (status === BillStatus.COMPLETED) return "confirmed";
  if (status === BillStatus.CLOSED) return "closed";
  return "unknown";
}

function mapCollectingPaymentBill(
  bill: CollectingPaymentBillDetail,
): CollectingPaymentBill {
  return {
    requesterId: bill.requesterId.toString(),
    requesterName: bill.requesterName,
    requesterAvatarUrl: bill.requesterAvatarUrl,
    paymentStatus: mapBillStatus(bill.paymentStatus),
    billId: bill.bill?.id.toString() ?? null,
    billNo: bill.bill?.billNo ?? null,
    billUpdatedAt: formatTimestamp(bill.bill?.updatedAt),
    paymentChannel: mapPaymentChannel(bill.bill?.channel),
    serialNumber: bill.bill?.serialNumber ?? null,
    verifyCode: bill.bill?.verifyCode || null,
    items: bill.items.map(mapCollectingPaymentItem),
    productAmountCents: bill.productAmountCents,
    serviceFeeAmountCents: bill.serviceFeeAmountCents,
    packagingFeeShareCents: bill.packagingFeeShareCents,
    totalAmountCents: bill.totalAmountCents,
  };
}

function mapPaymentChannel(
  channel: Channel | undefined,
): CollectingPaymentBill["paymentChannel"] {
  if (channel === Channel.WECHAT) return "wechat";
  if (channel === Channel.ALIPAY) return "alipay";
  return null;
}
