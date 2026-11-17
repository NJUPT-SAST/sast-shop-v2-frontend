"use client";

import { useState } from "react";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import {
  adminDomains,
  listAdminAudit,
  listAdminCorrections,
  type AdminAudit,
  type AdminCorrection,
  type AdminDomain,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  actionLabels,
  adminDate,
  adminStatus,
  domainLabels,
  resourceLabels,
} from "@/lib/admin-fields";
import {
  AdminError,
  AdminFields,
  AdminPagination,
  AdminSelect,
} from "./admin-common";
import { AdminCorrectionRecovery } from "./admin-correction-recovery";
import { useAdminSession } from "./admin-session";

export function AdminAuditView() {
  const { options, identity } = useAdminSession();
  const [domain, setDomain] = useState<AdminDomain>("user");
  const [tab, setTab] = useState<"audit" | "corrections">("audit");
  const [filters, setFilters] = useState({
    page: 1,
    resourceId: "",
    actorId: "",
    status: "",
    createdFrom: "",
    createdTo: "",
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const result = useCachedResource<{
    audits: AdminAudit[];
    corrections: AdminCorrection[];
    total: number;
  }>({
    cacheKey: JSON.stringify([
      "admin:audit",
      identity.id,
      identity.authVersion,
      domain,
      filters,
      tab,
    ]),
    load: async () => {
      if (tab === "audit") {
        const value = await listAdminAudit(domain, filters, options);
        return { audits: value.entries, corrections: [], total: value.total };
      }
      const value = await listAdminCorrections(domain, filters, options);
      return { audits: [], corrections: value.corrections, total: value.total };
    },
    staleTime: 5_000,
  });
  const audits = result.data?.audits ?? [];
  const corrections = result.data?.corrections ?? [];
  const total = result.data?.total ?? 0;
  const busy = result.loading;
  const error = result.error
    ? result.error instanceof Error
      ? result.error.message
      : "记录加载失败"
    : "";
  const load = result.refresh;
  function switchTab(value: typeof tab) {
    setTab(value);
    setExpanded(null);
    setFilters((current) => ({ ...current, page: 1 }));
  }
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">操作记录</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            按业务查询操作依据、前后变化和整单处理进度
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          刷新
        </Button>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="记录类型">
        <Button
          variant={tab === "audit" ? "default" : "outline"}
          onClick={() => switchTab("audit")}
        >
          操作审计
        </Button>
        <Button
          variant={tab === "corrections" ? "default" : "outline"}
          onClick={() => switchTab("corrections")}
        >
          交易处理进度
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setFilters({
            page: 1,
            resourceId: String(values.get("resourceId") ?? ""),
            actorId: String(values.get("actorId") ?? ""),
            status:
              values.get("status") === "all"
                ? ""
                : String(values.get("status") ?? ""),
            createdFrom: String(values.get("from") ?? ""),
            createdTo: String(values.get("to") ?? ""),
          });
        }}
      >
        <label className="space-y-1 text-xs">
          业务
          <AdminSelect
            label="业务"
            value={domain}
            onChange={(value) => {
              setDomain(value as AdminDomain);
              setFilters((current) => ({ ...current, page: 1 }));
              setExpanded(null);
            }}
            choices={adminDomains.map((key) => ({
              value: key,
              label: domainLabels[key],
            }))}
          />
        </label>
        <label className="w-44 space-y-1 text-xs">
          业务记录 ID
          <Input name="resourceId" placeholder="订单、用户或活动 ID" />
        </label>
        {tab === "audit" ? (
          <>
            <label className="w-36 space-y-1 text-xs">
              操作人 ID
              <Input name="actorId" />
            </label>
            <label className="w-44 space-y-1 text-xs">
              起始时间
              <Input name="from" type="datetime-local" />
            </label>
            <label className="w-44 space-y-1 text-xs">
              结束时间
              <Input name="to" type="datetime-local" />
            </label>
          </>
        ) : (
          <label className="w-40 space-y-1 text-xs">
            执行状态
            <AdminSelect
              name="status"
              label="执行状态"
              defaultValue="all"
              choices={[
                { value: "all", label: "全部状态" },
                { value: "preview", label: "待执行" },
                { value: "executing", label: "执行中" },
                { value: "retrying", label: "正在恢复" },
                { value: "completed", label: "已完成" },
                { value: "needs_attention", label: "待人工核查" },
                { value: "failed", label: "失败" },
              ]}
            />
          </label>
        )}
        <Button type="submit" disabled={busy}>
          查询
        </Button>
      </form>
      {error ? <AdminError message={error} retry={() => void load()} /> : null}
      <section className="rounded-lg border bg-card p-4" aria-busy={busy}>
        <div className="space-y-3">
          {tab === "audit"
            ? audits.map((entry) => (
                <article key={entry.id} className="rounded-lg border">
                  <button
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left text-sm hover:bg-muted/40"
                    aria-expanded={expanded === entry.id}
                    onClick={() =>
                      setExpanded((current) =>
                        current === entry.id ? null : entry.id,
                      )
                    }
                  >
                    <span className="font-medium">
                      {actionLabels[entry.action] ?? entry.action} ·{" "}
                      {resourceLabels[entry.resource]} {entry.resourceId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      操作人 {entry.actorId} · {adminDate(entry.createdAt)}
                    </span>
                  </button>
                  {expanded === entry.id ? (
                    <div className="space-y-4 border-t p-4">
                      <AdminFields
                        fields={[
                          {
                            key: "reason",
                            label: "处理原因",
                            value: entry.reason,
                          },
                          {
                            key: "evidence",
                            label: "核查依据",
                            value: entry.evidence,
                          },
                          {
                            key: "request",
                            label: "请求编号",
                            value: entry.requestId,
                          },
                        ]}
                      />
                      <div className="grid gap-4 lg:grid-cols-2">
                        <section className="space-y-3 rounded bg-muted/40 p-3">
                          <h3 className="text-sm font-medium">操作前</h3>
                          <AdminFields fields={entry.before} />
                        </section>
                        <section className="space-y-3 rounded bg-muted/40 p-3">
                          <h3 className="text-sm font-medium">操作后</h3>
                          <AdminFields fields={entry.after} />
                        </section>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            : corrections.map((entry) => (
                <article key={entry.id} className="rounded-lg border">
                  <button
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left text-sm hover:bg-muted/40"
                    aria-expanded={expanded === entry.id}
                    onClick={() =>
                      setExpanded((current) =>
                        current === entry.id ? null : entry.id,
                      )
                    }
                  >
                    <span className="font-medium">
                      {actionLabels[entry.action] ?? entry.action} ·{" "}
                      {entry.resourceId}
                    </span>
                    <span>
                      {adminStatus(entry.status)} · {adminDate(entry.updatedAt)}
                    </span>
                  </button>
                  {expanded === entry.id ? (
                    <div className="space-y-4 border-t p-4">
                      <AdminFields
                        fields={[
                          {
                            key: "reason",
                            label: "处理原因",
                            value: entry.reason,
                          },
                          {
                            key: "evidence",
                            label: "核查依据",
                            value: entry.evidence,
                          },
                        ]}
                      />
                      <AdminCorrectionRecovery
                        key={`${entry.id}:${entry.updatedAt}`}
                        domain={domain}
                        correction={entry}
                        onChanged={() => void load()}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
        </div>
        {!(tab === "audit" ? audits.length : corrections.length) ? (
          <p
            role="status"
            className="py-12 text-center text-sm text-muted-foreground"
          >
            {busy ? "正在加载记录…" : "暂无符合条件的记录"}
          </p>
        ) : null}
        <AdminPagination
          page={filters.page}
          total={total}
          busy={busy}
          onChange={(page) => setFilters((current) => ({ ...current, page }))}
        />
      </section>
    </div>
  );
}
