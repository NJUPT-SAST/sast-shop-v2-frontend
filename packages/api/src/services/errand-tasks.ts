import { createClient } from "@connectrpc/connect"
import type { ErrandTask as ProtoErrandTask } from "../gen/sast/sastshopv2/errand/v1/errand_task_pb"
import { ErrandTaskService } from "../gen/sast/sastshopv2/errand/v1/errand_task_service_pb"
import { ErrandTaskStatus } from "../gen/sast/sastshopv2/errand/v1/errand_task_status_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

const MAX_SIGNED_INT32 = 2147483647

export type ErrandTaskStatusValue =
  | "shopping"
  | "pending_distributing"
  | "distributing"
  | "collecting_payment"
  | "completed"
  | "cancelled"
  | "unknown"

export type ErrandTaskStatusFilter = Exclude<ErrandTaskStatusValue, "unknown">

export interface ErrandTask {
  id: string
  storeId: string
  storeName: string
  status: ErrandTaskStatusValue
  itemTotalCount: number
  createdAt: string | null
}

export async function listErrandTasks(
  options: ServiceOptions & {
    status?: ErrandTaskStatusFilter
    page?: number
    pageSize?: number
  } = {}
): Promise<ErrandTask[]> {
  const request = parseListErrandTasksOptions(options)
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(ErrandTaskService, createLocalTransport(options))
    const response = await requestLocal("listErrandTasks", () =>
      client.getErrandTaskList(request)
    )

    return response.errandTasks.map(mapErrandTask)
  }

  throw new FeatureUnavailableError("listErrandTasks")
}

function parseListErrandTasksOptions(options: {
  status?: ErrandTaskStatusFilter
  page?: number
  pageSize?: number
}): {
  page: number
  pageSize: number
  filterStatus?: ErrandTaskStatus
} {
  return {
    page: parsePositiveInteger(options.page ?? 1, "页码不正确"),
    pageSize: parsePositiveInteger(options.pageSize ?? 50, "每页数量不正确"),
    ...(options.status ? { filterStatus: parseStatusFilter(options.status) } : {}),
  }
}

function mapErrandTask(task: ProtoErrandTask): ErrandTask {
  return {
    id: task.taskId.toString(),
    storeId: task.storeId.toString(),
    storeName: task.storeName || "跑腿店铺",
    status: mapStatusFromProto(task.status),
    itemTotalCount: task.items.length,
    createdAt: formatTimestamp(task.createdAt),
  }
}

function mapStatusFromProto(status: ErrandTaskStatus): ErrandTaskStatusValue {
  if (status === ErrandTaskStatus.SHOPPING) return "shopping"
  if (status === ErrandTaskStatus.PENDING_DISTRIBUTING) {
    return "pending_distributing"
  }
  if (status === ErrandTaskStatus.DISTRIBUTING) return "distributing"
  if (status === ErrandTaskStatus.COLLECTING_PAYMENT) {
    return "collecting_payment"
  }
  if (status === ErrandTaskStatus.COMPLETED) return "completed"
  if (status === ErrandTaskStatus.CANCELLED) return "cancelled"
  return "unknown"
}

function parseStatusFilter(status: string): ErrandTaskStatus {
  const protoStatus = mapStatusToProto(status)

  if (protoStatus === undefined) {
    throw new ValidationError("团长任务状态不正确")
  }

  return protoStatus
}

function mapStatusToProto(status: string): ErrandTaskStatus | undefined {
  if (status === "shopping") return ErrandTaskStatus.SHOPPING
  if (status === "pending_distributing") {
    return ErrandTaskStatus.PENDING_DISTRIBUTING
  }
  if (status === "distributing") return ErrandTaskStatus.DISTRIBUTING
  if (status === "collecting_payment") return ErrandTaskStatus.COLLECTING_PAYMENT
  if (status === "completed") return ErrandTaskStatus.COMPLETED
  if (status === "cancelled") return ErrandTaskStatus.CANCELLED
  return undefined
}

function parsePositiveInteger(value: number, message: string): number {
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_SIGNED_INT32
  ) {
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
