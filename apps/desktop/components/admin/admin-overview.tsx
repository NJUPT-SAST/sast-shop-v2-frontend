"use client";

import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import Link from "next/link";
import { adminDomains, getAdminStats, type AdminDomain } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { adminMoney, domainLabels } from "@/lib/admin-fields";
import { AdminError } from "./admin-common";
import { useAdminSession } from "./admin-session";

type Metrics = Awaited<ReturnType<typeof getAdminStats>>;
export function AdminOverview() {
  const { identity, options } = useAdminSession();
  const stats = useCachedResource<
    Array<{ domain: AdminDomain; metrics: Metrics; error: string }>
  >({
    cacheKey: JSON.stringify([
      "admin:stats",
      identity.id,
      identity.authVersion,
    ]),
    staleTime: 15_000,
    load: async () => {
      const responses = await Promise.allSettled(
        adminDomains.map((domain) => getAdminStats(domain, options)),
      );
      return responses.map((response, index) => ({
        domain: adminDomains[index],
        metrics: response.status === "fulfilled" ? response.value : [],
        error:
          response.status === "rejected"
            ? response.reason instanceof Error
              ? response.reason.message
              : "统计加载失败"
            : "",
      }));
    },
  });
  const result = stats.data ?? [];
  const busy = stats.loading;
  const load = stats.refresh;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">运营概览</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {identity.name}，欢迎进入管理后台
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          {busy ? "刷新中…" : "刷新统计"}
        </Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {result.map(({ domain, metrics, error }) => (
          <section
            key={domain}
            className="space-y-4 rounded-xl border bg-card p-5"
          >
            <h2 className="font-semibold">{domainLabels[domain]}</h2>
            {error ? (
              <AdminError message={error} retry={() => void load()} />
            ) : metrics.length ? (
              <dl className="space-y-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.key}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {metric.label}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {metric.isMoney ? adminMoney(metric.value) : metric.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">暂无统计数据</p>
            )}
          </section>
        ))}
      </div>
      {busy && !result.length ? (
        <p role="status" className="text-sm text-muted-foreground">
          正在读取各业务统计…
        </p>
      ) : null}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">交易异常处理</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          从订单、账单或 West Pocket
          活动详情发起处理。先预览整单影响，核对依据后执行；处理进度和历史记录可在操作记录中查询
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/admin/audit">查看操作与处理记录</Link>
        </Button>
      </section>
    </div>
  );
}
