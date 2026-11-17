"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAdminRecord,
  listAdminRecords,
  type AdminRecord,
  type AdminResource,
  type AdminListFilter,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import {
  actionLabels,
  adminDate,
  adminMoney,
  adminStatus,
  adminStatusChoices,
  isRoleAction,
  resourceLabels,
  sectionResources,
} from "@/lib/admin-fields";
import {
  AdminError,
  AdminFields,
  AdminPagination,
  AdminSelect,
} from "./admin-common";
import { useAdminSession } from "./admin-session";
import { AdminActionDialog } from "./admin-action";

export function AdminRecordsView({
  resource,
  title,
  description,
  initialId,
}: {
  resource: AdminResource;
  title: string;
  description: string;
  initialId?: string;
}) {
  const { options, identity, refresh: refreshIdentity } = useAdminSession();
  const [filters, setFilters] = useState<AdminListFilter>({ page: 1 });
  const list = useCachedResource({
    cacheKey: JSON.stringify([
      "admin:records",
      identity.id,
      identity.authVersion,
      resource,
      filters,
    ]),
    load: () => listAdminRecords(resource, filters, options),
    staleTime: 15_000,
  });
  const records = list.data?.records ?? [];
  const total = list.data?.total ?? 0;
  const busy = list.loading;
  const error = list.error
    ? list.error instanceof Error
      ? list.error.message
      : "列表加载失败"
    : "";
  const load = list.refresh;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialId ?? null,
  );
  const [detail, setDetail] = useState<{
    record: AdminRecord;
    related: AdminRecord[];
  } | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [operation, setOperation] = useState<{
    record: AdminRecord;
    action: string;
  } | null>(null);
  const detailEpoch = useRef(0);
  const loadDetail = useCallback(
    async (id: string) => {
      const epoch = ++detailEpoch.current;
      setDetailBusy(true);
      setDetailError("");
      setDetail(null);
      try {
        const result = await getAdminRecord(resource, id, options);
        if (epoch === detailEpoch.current) setDetail(result);
      } catch (reason) {
        if (epoch === detailEpoch.current)
          setDetailError(
            reason instanceof Error ? reason.message : "详情加载失败",
          );
      } finally {
        if (epoch === detailEpoch.current) setDetailBusy(false);
      }
    },
    [resource, options],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedId) void loadDetail(selectedId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, loadDetail]);
  function changed() {
    void load();
    if (selectedId) void loadDetail(selectedId);
    if (resource === "user") void refreshIdentity();
  }
  function closeDetail() {
    detailEpoch.current++;
    setSelectedId(null);
    setDetail(null);
  }
  function create() {
    setOperation({
      action: "create",
      record: {
        resource,
        id: "",
        title: "",
        status: "",
        ownerId: "",
        createdAt: null,
        updatedAt: null,
        round: "0",
        amountCents: null,
        fields: [],
        allowedActions: [],
      },
    });
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={busy}>
            刷新
          </Button>
          {["store", "product"].includes(resource) &&
          identity.capabilities.includes("catalog.manage") ? (
            <Button onClick={create}>新建{resourceLabels[resource]}</Button>
          ) : null}
        </div>
      </header>
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setFilters({
            page: 1,
            keyword: String(data.get("keyword") ?? ""),
            status:
              data.get("status") === "all"
                ? ""
                : String(data.get("status") ?? ""),
            userId: String(data.get("userId") ?? ""),
            createdFrom: String(data.get("from") ?? ""),
            createdTo: String(data.get("to") ?? ""),
          });
        }}
      >
        <label className="min-w-40 flex-1 space-y-1 text-xs">
          名称或编号
          <Input name="keyword" placeholder="搜索名称、编号或条码" />
        </label>
        <label className="w-32 space-y-1 text-xs">
          状态
          <AdminSelect
            name="status"
            label="状态筛选"
            defaultValue="all"
            choices={adminStatusChoices(resource)}
          />
        </label>
        <label className="w-36 space-y-1 text-xs">
          关联用户 ID
          <Input name="userId" placeholder="用户 ID" />
        </label>
        <label className="w-44 space-y-1 text-xs">
          起始时间
          <Input name="from" type="datetime-local" />
        </label>
        <label className="w-44 space-y-1 text-xs">
          结束时间
          <Input name="to" type="datetime-local" />
        </label>
        <Button type="submit" disabled={busy}>
          查询
        </Button>
      </form>
      {error ? <AdminError message={error} retry={() => void load()} /> : null}
      <section className="rounded-lg border bg-card p-4" aria-busy={busy}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">记录</th>
                <th className="px-3 py-3 font-medium">状态</th>
                <th className="px-3 py-3 font-medium">所属用户</th>
                <th className="px-3 py-3 font-medium">金额</th>
                <th className="px-3 py-3 font-medium">最近更新</th>
                <th className="px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b last:border-0">
                  <td className="max-w-64 px-3 py-3">
                    <p className="truncate font-medium">
                      {record.title || record.id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.id}
                      {record.round !== "0" ? ` · 第 ${record.round} 轮` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">
                      {adminStatus(record.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{record.ownerId || "—"}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {adminMoney(record.amountCents)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {adminDate(record.updatedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        detailEpoch.current++;
                        setDetail(null);
                        setSelectedId(record.id);
                      }}
                    >
                      查看与处理
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length ? (
          <p
            role="status"
            className="py-12 text-center text-sm text-muted-foreground"
          >
            {busy ? "正在加载记录…" : "没有符合条件的记录"}
          </p>
        ) : null}
        <AdminPagination
          page={filters.page ?? 1}
          total={total}
          busy={busy}
          onChange={(page) => setFilters((current) => ({ ...current, page }))}
        />
      </section>
      {selectedId ? (
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">记录详情 · {selectedId}</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={detailBusy}
                onClick={() => void loadDetail(selectedId)}
              >
                刷新详情
              </Button>
              <Button variant="ghost" size="sm" onClick={closeDetail}>
                收起
              </Button>
            </div>
          </div>
          {detailBusy ? (
            <p role="status" className="text-sm">
              正在加载详情…
            </p>
          ) : null}
          {detailError ? (
            <AdminError
              message={detailError}
              retry={() => void loadDetail(selectedId)}
            />
          ) : null}
          {detail ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {adminStatus(detail.record.status)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  第 {detail.record.round} 轮 ·{" "}
                  {adminDate(detail.record.updatedAt)}
                </span>
              </div>
              <AdminFields fields={detail.record.fields} />
              {sourceRecordLink(detail.record) ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p>
                    此账单属于关联交易。退款或撤销收款请从源交易整单处理，确保订单、库存与账单一致。
                  </p>
                  <Button asChild variant="outline">
                    <Link href={sourceRecordLink(detail.record)!}>
                      查看并处理源交易
                    </Link>
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {detail.record.allowedActions
                  .filter(
                    (action) =>
                      actionLabels[action] &&
                      (!isRoleAction(action) || identity.role === "superadmin"),
                  )
                  .map((action) => (
                    <Button
                      key={action}
                      variant={
                        [
                          "ban",
                          "block",
                          "cancel",
                          "revoke_admin",
                          "revoke_superadmin",
                        ].includes(action)
                          ? "destructive"
                          : "outline"
                      }
                      onClick={() =>
                        setOperation({ record: detail.record, action })
                      }
                    >
                      {actionLabels[action]}
                    </Button>
                  ))}
              </div>
              {detail.related.length ? (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="font-medium">关联记录</h3>
                  {detail.related.map((record) => (
                    <div
                      key={`${record.resource}:${record.id}`}
                      className="rounded border p-3"
                    >
                      <p className="mb-3 text-sm font-medium">
                        {resourceLabels[record.resource]} ·{" "}
                        {record.title || record.id} ·{" "}
                        {adminStatus(record.status)}
                      </p>
                      <AdminFields fields={record.fields} />
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-3"
                      >
                        <Link href={recordLink(record.resource, record.id)}>
                          查看关联记录
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
      {operation ? (
        <AdminActionDialog
          key={`${operation.record.id}:${operation.action}:${operation.record.updatedAt}`}
          {...operation}
          onClose={() => setOperation(null)}
          onChanged={changed}
        />
      ) : null}
    </div>
  );
}

function recordLink(resource: AdminResource, id: string) {
  const section = Object.entries(sectionResources).find(
    ([, value]) => value === resource,
  )?.[0];
  return `/admin/${section ?? "audit"}?id=${encodeURIComponent(id)}`;
}
function sourceRecordLink(record: AdminRecord) {
  if (record.resource !== "bill") return null;
  const sourceType = record.fields.find(
    (field) => field.key === "source_type",
  )?.value;
  const sourceId = record.fields.find(
    (field) => field.key === "source_id",
  )?.value;
  const resources: Record<string, AdminResource> = {
    spot_order: "spot_order",
    errand_task: "errand_task",
    west_pocket: "pocket",
  };
  const resource = sourceType ? resources[sourceType] : undefined;
  return resource && sourceId ? recordLink(resource, sourceId) : null;
}
