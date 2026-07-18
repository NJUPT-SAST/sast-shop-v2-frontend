import Link from "next/link"
import {
  listErrandTasks,
  listStores,
  type ErrandTaskBrief,
  type Store,
} from "@sast-shop/api"
import {
  RiArrowRightSLine,
  RiRunLine,
  RiStore2Line,
} from "@remixicon/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"

import { ManagedImage } from "@/components/managed-image"
import { getActiveErrandTasks } from "@/lib/errand-task-route"
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/order-filters"
import { parsePositiveInt64RouteId } from "@/lib/route-id"
import { getServerServiceOptions } from "@/lib/server-service-options"

export default async function GroupPage() {
  const options = await getServerServiceOptions()
  const [storesResult, tasksResult] = await Promise.allSettled([
    listStores(options),
    listErrandTasks(options),
  ])
  const stores = storesResult.status === "fulfilled" ? storesResult.value : []
  const tasks =
    tasksResult.status === "fulfilled"
      ? getActiveErrandTasks(tasksResult.value)
      : []

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
            <h2 className="text-xl font-semibold">选择店铺</h2>
          </div>

          {storesResult.status === "rejected" ? (
            <Empty
              icon={<RiStore2Line className="size-5" />}
              title="店铺暂不可用"
              description="请检查数据服务后重新加载。"
            />
          ) : stores.length === 0 ? (
            <Empty
              icon={<RiStore2Line className="size-5" />}
              title="暂无可用店铺"
              description="店铺完成配置后会显示在这里。"
            />
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">正在采购</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/orders?type=errand&view=captain">查看全部</Link>
              </Button>
            </div>
            {tasksResult.status === "rejected" ? (
              <p className="text-sm text-destructive">采购任务加载失败。</p>
            ) : tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                当前没有进行中的团长任务。
              </p>
            ) : (
              <div className="grid gap-2">
                {tasks.slice(0, 4).map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function StoreCard({ store }: { store: Store }) {
  const id = parsePositiveInt64RouteId(store.id)
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
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {store.address || "暂无店铺地址"}
          </p>
          <span className="mt-3 inline-flex items-center text-sm font-medium text-primary">
            选择商品
            <RiArrowRightSLine className="size-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  )

  if (!id) return <div className="opacity-60">{content}</div>

  return (
    <Link
      href={`/group/shop/${id}`}
      prefetch={false}
      className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  )
}

function TaskItem({ task }: { task: ErrandTaskBrief }) {
  const id = parsePositiveInt64RouteId(task.id)
  const content = (
    <Item variant="outline" className="min-w-0">
      <ItemContent className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ItemTitle className="truncate">{task.storeName}</ItemTitle>
          <Badge
            variant={getStatusBadgeVariant(task.status)}
            className="shrink-0"
          >
            {getStatusLabel(task.status)}
          </Badge>
        </div>
        <ItemDescription>{task.itemCount} 种商品</ItemDescription>
      </ItemContent>
      {id ? (
        <ItemActions>
          <RiArrowRightSLine className="size-4 text-muted-foreground" />
        </ItemActions>
      ) : null}
    </Item>
  )

  if (!id) return <div className="opacity-60">{content}</div>

  return (
    <Link
      href={`/group/purchase/${id}`}
      prefetch={false}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  )
}
