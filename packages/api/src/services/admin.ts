import { createClient, Code, ConnectError } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
  UserAdminService,
  CatalogAdminService,
  SpotAdminService,
  ErrandAdminService,
  PaymentAdminService,
  WestPocketAdminService,
} from "../gen/sast/sastshopv2/admin/v1/admin_service_pb";
import {
  ResourceKind,
  type AdminRecord as ProtoRecord,
  type Correction as ProtoCorrection,
  type AuditEntry as ProtoAudit,
  type Impact as ProtoImpact,
} from "../gen/sast/sastshopv2/admin/v1/admin_pb";
import { formatProtoTimestamp, parseProtoTimestamp } from "../proto-timestamp";
import { ValidationError } from "../errors";

export type AdminDomain =
  "user" | "catalog" | "spot" | "errand" | "payment" | "pocket";
export type AdminResource =
  | "user"
  | "store"
  | "product"
  | "spot_goods"
  | "spot_order"
  | "errand_demand"
  | "errand_task"
  | "bill"
  | "pocket"
  | "job";
export interface AdminOptions {
  connectBaseUrl: string;
  fetch?: typeof globalThis.fetch;
}
export interface AdminIdentity {
  id: string;
  name: string;
  avatarUrl: string;
  role: "admin" | "superadmin";
  status: string;
  authVersion: string;
  capabilities: string[];
}
export interface AdminField {
  key: string;
  label: string;
  value: string;
}
export interface AdminRecord {
  resource: AdminResource;
  id: string;
  title: string;
  status: string;
  ownerId: string;
  createdAt: string | null;
  updatedAt: string | null;
  round: string;
  amountCents: number | null;
  fields: AdminField[];
  allowedActions: string[];
}
export interface AdminImpact {
  resource: AdminResource;
  id: string;
  description: string;
  before: string;
  after: string;
}
export interface AdminCorrection {
  digest?: string;
  requestId?: string;
  id: string;
  resource: AdminResource;
  resourceId: string;
  action: string;
  status: string;
  reason: string;
  evidence: string;
  actorId: string;
  round: string;
  createdAt: string | null;
  updatedAt: string | null;
  steps: Array<{
    key: string;
    description: string;
    status: string;
    error: string;
  }>;
  impacts: AdminImpact[];
  error: string;
}
export interface AdminAudit {
  id: string;
  actorId: string;
  resource: AdminResource;
  resourceId: string;
  action: string;
  reason: string;
  evidence: string;
  requestId: string;
  createdAt: string | null;
  before: AdminField[];
  after: AdminField[];
}
export interface AdminPreview {
  id: string;
  digest: string;
  expiresAt: string | null;
  record: AdminRecord | null;
  impacts: AdminImpact[];
  warnings: string[];
  restorationFields: AdminField[];
}
export interface AdminMutation {
  resource: AdminResource;
  id: string;
  action: string;
  updatedAt: string | null;
  round: string;
  reason: string;
  evidence: string;
  values: Record<string, string>;
}
export interface AdminListFilter {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  userId?: string;
  createdFrom?: string;
  createdTo?: string;
}
export class AdminAccessError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AdminAccessError";
  }
}
export class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain: boolean,
    readonly code: Code = Code.Unknown,
  ) {
    super(message);
    this.name = "AdminRequestError";
  }
}

const resources: Record<AdminResource, ResourceKind> = {
  user: ResourceKind.USER,
  store: ResourceKind.STORE,
  product: ResourceKind.PRODUCT,
  spot_goods: ResourceKind.SPOT_GOODS,
  spot_order: ResourceKind.SPOT_ORDER,
  errand_demand: ResourceKind.ERRAND_DEMAND,
  errand_task: ResourceKind.ERRAND_TASK,
  bill: ResourceKind.BILL,
  pocket: ResourceKind.POCKET,
  job: ResourceKind.JOB,
};
const domains: Record<AdminResource, AdminDomain> = {
  user: "user",
  store: "catalog",
  product: "catalog",
  spot_goods: "spot",
  spot_order: "spot",
  errand_demand: "errand",
  errand_task: "errand",
  bill: "payment",
  pocket: "pocket",
  job: "pocket",
};
const services = {
  user: UserAdminService,
  catalog: CatalogAdminService,
  spot: SpotAdminService,
  errand: ErrandAdminService,
  payment: PaymentAdminService,
  pocket: WestPocketAdminService,
};
export const adminDomains: AdminDomain[] = [
  "user",
  "catalog",
  "spot",
  "errand",
  "payment",
  "pocket",
];
export function adminDomainFor(resource: AdminResource) {
  return domains[resource];
}
function client(domain: AdminDomain, options: AdminOptions) {
  const transport = createConnectTransport({
    baseUrl: options.connectBaseUrl,
    defaultTimeoutMs: 20_000,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return createClient(services[domain], transport);
}
async function request<T>(call: () => Promise<T>, write = false): Promise<T> {
  try {
    return await call();
  } catch (cause) {
    const error = ConnectError.from(cause);
    if (
      error.code === Code.Unauthenticated ||
      error.code === Code.PermissionDenied
    ) {
      const status = error.code === Code.Unauthenticated ? 401 : 403;
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("sast-shop:admin-access-changed"));
      throw new AdminAccessError(
        status,
        status === 401
          ? "登录已失效，请重新登录"
          : "当前账号没有此操作权限，或权限已变更",
      );
    }
    throw new AdminRequestError(
      error.rawMessage || "操作暂未完成，请稍后重试",
      write &&
        [
          Code.Unknown,
          Code.Unavailable,
          Code.DeadlineExceeded,
          Code.Internal,
          Code.Canceled,
        ].includes(error.code),
      error.code,
    );
  }
}
function resourceName(kind: ResourceKind): AdminResource {
  const entry = Object.entries(resources).find(([, value]) => value === kind);
  if (!entry) throw new ValidationError("后台返回了未知资源类型");
  return entry[0] as AdminResource;
}
function mapFields(fields: readonly AdminField[]): AdminField[] {
  return fields.map(({ key, label, value }) => ({ key, label, value }));
}
function mapRecord(value: ProtoRecord): AdminRecord {
  return {
    resource: resourceName(value.resource),
    id: value.id,
    title: value.title,
    status: value.status,
    ownerId: value.ownerId,
    createdAt: formatProtoTimestamp(value.createdAt),
    updatedAt: formatProtoTimestamp(value.updatedAt),
    round: value.lifecycleRound.toString(),
    amountCents:
      value.amountCents === undefined ? null : Number(value.amountCents),
    fields: mapFields(value.fields),
    allowedActions: [...value.allowedActions],
  };
}
function mapImpact(value: ProtoImpact): AdminImpact {
  return {
    resource: resourceName(value.resource),
    id: value.resourceId,
    description: value.description,
    before: value.before,
    after: value.after,
  };
}
function mapCorrection(value: ProtoCorrection): AdminCorrection {
  return {
    digest: value.digest,
    requestId: value.requestId,
    id: value.id,
    resource: resourceName(value.resource),
    resourceId: value.resourceId,
    action: value.action,
    status: value.status,
    reason: value.reason,
    evidence: value.evidence,
    actorId: value.actorId,
    round: value.lifecycleRound.toString(),
    createdAt: formatProtoTimestamp(value.createdAt),
    updatedAt: formatProtoTimestamp(value.updatedAt),
    steps: value.steps.map(({ key, description, status, error }) => ({
      key,
      description,
      status,
      error,
    })),
    impacts: value.impacts.map(mapImpact),
    error: value.error,
  };
}
function mapAudit(value: ProtoAudit): AdminAudit {
  return {
    id: value.id,
    actorId: value.actorId,
    resource: resourceName(value.resource),
    resourceId: value.resourceId,
    action: value.action,
    reason: value.reason,
    evidence: value.evidence,
    requestId: value.requestId,
    createdAt: formatProtoTimestamp(value.createdAt),
    before: mapFields(value.before),
    after: mapFields(value.after),
  };
}
function required<T>(value: T | undefined, label: string): T {
  if (value === undefined)
    throw new ValidationError(`后台未返回${label}，请刷新核实`);
  return value;
}
function date(value: string | undefined) {
  return value
    ? parseProtoTimestamp(new Date(value).toISOString(), "筛选时间不正确")
    : undefined;
}
function mutation(input: AdminMutation) {
  if (!input.reason.trim() || input.reason.length > 1000)
    throw new ValidationError("请填写 1 至 1000 字的处理原因");
  if (!input.evidence.trim() || input.evidence.length > 4000)
    throw new ValidationError("请填写 1 至 4000 字的处理依据");
  if (!/^\d+$/.test(input.round))
    throw new ValidationError("处理轮次不正确，请刷新详情");
  if (input.action !== "create" && !input.updatedAt)
    throw new ValidationError("缺少记录版本，请刷新详情");
  return {
    resource: resources[input.resource],
    id: input.id,
    action: input.action,
    expectedUpdatedAt: input.updatedAt
      ? parseProtoTimestamp(input.updatedAt, "记录版本不正确")
      : undefined,
    expectedRound: BigInt(input.round),
    reason: input.reason.trim(),
    evidence: input.evidence.trim(),
    values: input.values,
  };
}
export async function getAdminContext(
  options: AdminOptions,
): Promise<AdminIdentity> {
  const transport = createConnectTransport({
    baseUrl: options.connectBaseUrl,
    defaultTimeoutMs: 10_000,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const value = await request(() =>
    createClient(UserAdminService, transport).getContext({}),
  );
  if (
    (value.role !== "admin" && value.role !== "superadmin") ||
    value.status !== "active"
  )
    throw new AdminAccessError(403, "当前账号没有管理员权限或已被停用");
  return {
    id: value.userId,
    name: value.displayName,
    avatarUrl: value.avatarUrl,
    role: value.role,
    status: value.status,
    authVersion: value.authVersion.toString(),
    capabilities: [...value.capabilities],
  };
}
export async function listAdminRecords(
  resource: AdminResource,
  filters: AdminListFilter,
  options: AdminOptions,
) {
  const result = await request(() =>
    client(domains[resource], options).listRecords({
      resource: resources[resource],
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      keyword: filters.keyword ?? "",
      status: filters.status ?? "",
      userId: filters.userId ?? "",
      createdFrom: date(filters.createdFrom),
      createdTo: date(filters.createdTo),
    }),
  );
  return {
    records: result.records.map(mapRecord),
    total: Number(result.totalCount),
    page: result.page,
    pageSize: result.pageSize,
  };
}
export async function getAdminRecord(
  resource: AdminResource,
  id: string,
  options: AdminOptions,
) {
  const result = await request(() =>
    client(domains[resource], options).getRecord({
      resource: resources[resource],
      id,
    }),
  );
  return {
    record: mapRecord(required(result.record, "记录详情")),
    related: result.relatedRecords.map(mapRecord),
  };
}
export async function mutateAdminRecord(
  input: AdminMutation & { requestId: string },
  options: AdminOptions,
) {
  const result = await request(
    () =>
      client(domains[input.resource], options).mutateRecord({
        ...mutation(input),
        requestId: input.requestId,
      }),
    true,
  );
  return {
    record: mapRecord(required(result.record, "操作结果")),
    operationId: result.operationId,
  };
}
export async function previewAdminCorrection(
  input: AdminMutation,
  options: AdminOptions,
): Promise<AdminPreview> {
  const result = await request(() =>
    client(domains[input.resource], options).previewCorrection(mutation(input)),
  );
  return {
    id: result.previewId,
    digest: result.digest,
    expiresAt: formatProtoTimestamp(result.expiresAt),
    record: result.record ? mapRecord(result.record) : null,
    impacts: result.impacts.map(mapImpact),
    warnings: [...result.warnings],
    restorationFields: mapFields(result.restorationFields),
  };
}
export async function executeAdminCorrection(
  domain: AdminDomain,
  input: { previewId: string; digest: string; requestId: string },
  options: AdminOptions,
) {
  const result = await request(
    () => client(domain, options).executeCorrection(input),
    true,
  );
  return mapCorrection(required(result.correction, "处理结果"));
}
export async function getAdminCorrection(
  domain: AdminDomain,
  id: string,
  options: AdminOptions,
) {
  const result = await request(() =>
    client(domain, options).getCorrection({ id }),
  );
  return mapCorrection(required(result.correction, "处理结果"));
}
export async function listAdminCorrections(
  domain: AdminDomain,
  filters: { page?: number; status?: string; resourceId?: string },
  options: AdminOptions,
) {
  const result = await request(() =>
    client(domain, options).listCorrections({
      page: filters.page ?? 1,
      pageSize: 20,
      status: filters.status ?? "",
      resourceId: filters.resourceId ?? "",
    }),
  );
  return {
    corrections: result.corrections.map(mapCorrection),
    total: Number(result.totalCount),
  };
}
export async function listAdminAudit(
  domain: AdminDomain,
  filters: AdminListFilter & {
    resource?: AdminResource;
    resourceId?: string;
    actorId?: string;
    action?: string;
    requestId?: string;
  },
  options: AdminOptions,
) {
  const result = await request(() =>
    client(domain, options).listAudit({
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      actorId: filters.actorId ?? "",
      resource: filters.resource
        ? resources[filters.resource]
        : ResourceKind.UNSPECIFIED,
      resourceId: filters.resourceId ?? "",
      action: filters.action ?? "",
      requestId: filters.requestId ?? "",
      createdFrom: date(filters.createdFrom),
      createdTo: date(filters.createdTo),
    }),
  );
  return {
    entries: result.entries.map(mapAudit),
    total: Number(result.totalCount),
  };
}
export async function getAdminStats(
  domain: AdminDomain,
  options: AdminOptions,
) {
  const result = await request(() => client(domain, options).getStats({}));
  return result.metrics.map(({ key, label, value, isMoney }) => ({
    key,
    label,
    value: value.toString(),
    isMoney,
  }));
}
