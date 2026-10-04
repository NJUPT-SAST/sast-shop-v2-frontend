import {
  listErrandTasks,
  listStores,
  type ErrandTaskBrief,
  type ErrandTaskStatusFilter,
  type Store,
} from "@sast-shop/api";
import {
  RiArrowRightSLine,
  RiFileAddLine,
  RiRunLine,
  RiStore2Line,
} from "@remixicon/react";
import Link from "next/link";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Empty } from "@workspace/ui/components/empty";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { ManagedImage } from "@/components/managed-image";
import { StoreCreateDialog } from "@/components/store-create-dialog";
import { mobileAppConfig } from "@/lib/app-config";
import { getGroupTaskPreview } from "@/lib/errand-task-route";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { isValidRouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

async function loadGroupOverview(): Promise<{
  stores: Store[];
  tasks: ErrandTaskBrief[];
  storeError: string | null;
  taskError: string | null;
}> {
  const options = await getServerServiceOptions();
  const activeStatuses: ErrandTaskStatusFilter[] = [
    "shopping",
    "pending_distributing",
    "distributing",
    "collecting_payment",
  ];
  const [storeResult, taskResult] = await Promise.allSettled([
    listStores(options),
    Promise.all(
      activeStatuses.map((status) =>
        listErrandTasks({ ...options, status, page: 1, pageSize: 2 }),
      ),
    ).then((pages) => pages.flat()),
  ]);

  return {
    stores: storeResult.status === "fulfilled" ? storeResult.value : [],
    tasks:
      taskResult.status === "fulfilled"
        ? getGroupTaskPreview(taskResult.value)
        : [],
    storeError:
      storeResult.status === "rejected" ? "店铺暂不可用，请稍后再试" : null,
    taskError:
      taskResult.status === "rejected" ? "采购任务暂不可用，请稍后再试" : null,
  };
}

export default async function GroupPage() {
  const { stores, tasks, storeError, taskError } = await loadGroupOverview();

  return (
    <div className="flex flex-1 flex-col gap-8 py-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold leading-7 md:text-2xl">团购</h1>
      </section>

      {taskError || tasks.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="min-w-0 text-xl font-semibold leading-7 md:text-2xl">
              进行中的任务
            </h2>
            {tasks.length > 0 ? (
              <Button
                asChild
                variant="ghost"
                size="touch"
                className="text-primary"
              >
                <Link href="/orders?type=errand&view=captain">全部任务</Link>
              </Button>
            ) : null}
          </div>

          {taskError ? (
            <LoadFailure
              variant="compact"
              title="采购任务加载失败"
              description={taskError}
              retryHref="/group"
            />
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="min-w-0 text-xl font-semibold leading-7 md:text-2xl">
            我要拼单
          </h2>
          <StoreCreateDialog
            dataSource={mobileAppConfig.dataSource}
            connectBaseUrl={mobileAppConfig.connectBaseUrl}
            returnTo="/group"
          >
            <Button
              variant="ghost"
              size="touch"
              className="gap-1.5 text-primary"
            >
              <RiStore2Line aria-hidden="true" />
              创建店铺
            </Button>
          </StoreCreateDialog>
        </div>

        {storeError ? (
          <LoadFailure
            variant="compact"
            title="店铺信息加载失败"
            description={storeError}
            retryHref="/group"
          />
        ) : stores.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4">
            {stores.map((store) =>
              isValidRouteId(store.id) ? (
                <Link
                  key={store.id}
                  href={`/group/shop/${store.id}`}
                  prefetch={false}
                  className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <StoreCard store={store} />
                </Link>
              ) : (
                <div key={store.id} className="rounded-lg opacity-70">
                  <StoreCard store={store} />
                </div>
              ),
            )}
          </div>
        ) : (
          <Empty
            icon={<RiStore2Line className="size-5" />}
            title="暂无店铺"
            description="可以先创建店铺。"
            action={
              <StoreCreateDialog
                dataSource={mobileAppConfig.dataSource}
                connectBaseUrl={mobileAppConfig.connectBaseUrl}
                returnTo="/group"
              >
                <Button type="button" size="touch">
                  创建店铺
                </Button>
              </StoreCreateDialog>
            }
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 md:text-2xl">
            团长工具
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/group/errand"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full rounded-lg border-primary/10 bg-section-highlight p-1 text-section-highlight-foreground">
              <CardHeader className="gap-3">
                <RiRunLine className="size-8 text-primary" />
                <div className="min-w-0">
                  <CardTitle className="truncate text-base leading-5">
                    跑腿大厅
                  </CardTitle>
                </div>
              </CardHeader>
            </Card>
          </Link>
          <Link
            href="/group/templates"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="rounded-lg p-1">
              <CardHeader className="gap-3">
                <RiFileAddLine className="size-8 text-primary" />
                <div className="min-w-0">
                  <CardTitle className="truncate text-base leading-5">
                    商品模板
                  </CardTitle>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task }: { task: ErrandTaskBrief }) {
  const canOpen = isValidRouteId(task.id);
  const card = (
    <Card className="min-w-0 overflow-hidden rounded-lg transition-colors group-hover:border-primary/40">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base leading-6">
              {task.storeName}
            </CardTitle>
            <CardDescription className="mt-1">
              {task.itemCount} 种商品
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={getStatusBadgeVariant(task.status)}>
              {getStatusLabel(task.status)}
            </Badge>
            {canOpen ? (
              <RiArrowRightSLine className="size-5 text-muted-foreground" />
            ) : null}
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  if (!canOpen) {
    return <div className="opacity-70">{card}</div>;
  }

  return (
    <Link
      href={`/group/purchase/${task.id}`}
      prefetch={false}
      className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  );
}

function StoreCard({ store }: { store: Store }) {
  return (
    <Card className="overflow-hidden rounded-lg transition-colors hover:border-primary/30">
      <CardHeader className="min-h-36 justify-between">
        {store.logoUrl ? (
          <ManagedImage
            src={store.logoUrl}
            alt={store.name}
            className="size-11 rounded-md"
            imageClassName="p-2"
          />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-md bg-accent text-primary">
            <RiStore2Line className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <CardTitle className="truncate text-lg leading-6">
            {store.name}
          </CardTitle>
          {store.address ? (
            <CardDescription className="truncate">
              {store.address}
            </CardDescription>
          ) : null}
        </div>
      </CardHeader>
    </Card>
  );
}
