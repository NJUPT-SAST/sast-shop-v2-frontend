"use client";

import Link from "next/link";
import {
  listErrandTasks,
  listStores,
  type ErrandTaskStatusFilter,
  type DataSource,
  type Store,
} from "@sast-shop/api";
import { RiArrowRightSLine, RiRunLine, RiStore2Line } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@workspace/ui/components/collapsible";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import { LoadFailure } from "@workspace/ui/components/load-failure";

import { ManagedImage } from "@/components/managed-image";
import { BrandIllustration } from "@/components/brand-illustration";
import { ErrandTaskCard } from "@/components/errand-task-card";
import { StoreCreateDialog } from "@/components/store-create-dialog";
import { getActiveErrandTasks } from "@/lib/errand-task-route";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { Skeleton } from "@workspace/ui/components/skeleton";

const activeStatuses: ErrandTaskStatusFilter[] = [
  "shopping",
  "pending_distributing",
  "distributing",
  "collecting_payment",
];

export function GroupOverviewClient({
  dataSource,
  connectBaseUrl,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  refreshKey: string;
}) {
  const options = { dataSource, connectBaseUrl };
  const cacheScope = JSON.stringify([dataSource, connectBaseUrl]);
  const storesResource = useCachedResource({
    cacheKey: `group:stores:${cacheScope}`,
    load: () => listStores(options),
    staleTime: 300_000,
    refreshKey,
  });
  const tasksResource = useCachedResource({
    cacheKey: `group:tasks:${cacheScope}`,
    load: async () => {
      const pages = await Promise.all(
        activeStatuses.map((status) =>
          listErrandTasks({ ...options, status, page: 1, pageSize: 4 }),
        ),
      );
      return getActiveErrandTasks(pages.flat()).filter(
        (task, index, sorted) =>
          sorted.findIndex((candidate) => candidate.id === task.id) === index,
      );
    },
    staleTime: 30_000,
    refreshKey,
  });
  const stores = storesResource.data ?? [];
  const tasks = tasksResource.data ?? [];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">团购</h1>
        <Button asChild>
          <Link href="/group/errand">
            <RiRunLine data-icon="inline-start" />
            进入跑腿大厅
          </Link>
        </Button>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold">店铺拼单</h2>
            <StoreCreateDialog
              dataSource={dataSource}
              connectBaseUrl={connectBaseUrl}
              returnTo="/group"
            >
              <Button variant="outline" size="sm">
                <RiStore2Line data-icon="inline-start" />
                创建店铺
              </Button>
            </StoreCreateDialog>
          </div>

          {storesResource.error && storesResource.data ? (
            <LoadFailure
              variant="compact"
              title="店铺更新失败"
              description="已保留上次加载的店铺信息"
              onRetry={() => void storesResource.refresh()}
            />
          ) : null}

          {storesResource.loading && !storesResource.data ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : storesResource.error && !storesResource.data ? (
            <LoadFailure
              title="店铺加载失败"
              description="网络或服务暂时不可用，请稍后重试。"
              onRetry={() => void storesResource.refresh()}
            />
          ) : stores.length === 0 ? (
            <Empty
              illustration={<BrandIllustration name="store" size={96} />}
              title="还没有店铺"
              action={
                <StoreCreateDialog
                  dataSource={dataSource}
                  connectBaseUrl={connectBaseUrl}
                  returnTo="/group"
                >
                  <Button>创建店铺</Button>
                </StoreCreateDialog>
              }
            />
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0">
          <Collapsible open={tasks.length > 0 || Boolean(tasksResource.error)}>
            <CollapsibleContent>
              <section className="flex flex-col gap-3 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">进行中的任务</h2>
                  {tasks.length > 0 ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/orders?type=errand&view=captain">
                        查看全部
                      </Link>
                    </Button>
                  ) : null}
                </div>
                {tasksResource.error && tasksResource.data ? (
                  <LoadFailure
                    variant="compact"
                    title="采购任务更新失败"
                    description="已保留上次加载的采购任务"
                    onRetry={() => void tasksResource.refresh()}
                  />
                ) : null}

                {tasksResource.error && !tasksResource.data ? (
                  <LoadFailure
                    variant="compact"
                    title="采购任务加载失败"
                    onRetry={() => void tasksResource.refresh()}
                  />
                ) : (
                  <div className="grid gap-2">
                    {tasks.slice(0, 4).map((task) => (
                      <ErrandTaskCard
                        key={task.id}
                        task={task}
                        options={options}
                      />
                    ))}
                  </div>
                )}
              </section>
            </CollapsibleContent>
          </Collapsible>

          <section className="space-y-3">
            <h2 className="font-semibold">团长工具</h2>
            <div className="grid gap-2">
              <Link
                href="/publish/spot"
                className="group flex min-h-20 items-center gap-3 rounded-lg border bg-card px-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrandIllustration name="manual" size={40} />
                <span className="min-w-0 flex-1 font-medium">上架现货</span>
                <RiArrowRightSLine className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </Link>
              <Link
                href="/group/templates"
                className="group flex min-h-20 items-center gap-3 rounded-lg border bg-card px-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrandIllustration name="template" size={40} />
                <span className="min-w-0 flex-1 font-medium">商品模板</span>
                <RiArrowRightSLine className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StoreCard({ store }: { store: Store }) {
  const id = parsePositiveInt64RouteId(store.id);
  const content = (
    <Card className="h-full min-w-0 overflow-hidden transition-colors group-hover:border-primary/40">
      <CardContent className="flex min-w-0 items-center gap-4 p-4">
        <ManagedImage
          src={store.logoUrl}
          alt={store.name}
          className="size-16 shrink-0 rounded-lg border"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{store.name}</h3>
          {store.address ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {store.address}
            </p>
          ) : null}
        </div>
        {id ? (
          <RiArrowRightSLine className="size-5 shrink-0 text-muted-foreground" />
        ) : null}
      </CardContent>
    </Card>
  );

  if (!id) return <div className="opacity-60">{content}</div>;

  return (
    <Link
      href={`/group/shop/${id}`}
      prefetch={false}
      className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  );
}
