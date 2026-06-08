import { getCurrentUser } from "@sast-shop/api"
import { getOrderStatusMeta } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { desktopAppConfig } from "@/lib/app-config"

async function loadCurrentUser() {
  try {
    return {
      user: await getCurrentUser({ dataSource: desktopAppConfig.dataSource }),
      error: null,
    }
  } catch (error) {
    return {
      user: null,
      error:
        error instanceof Error
          ? error.message
          : "当前数据源暂不可用，请稍后再试",
    }
  }
}

const metricCards = [
  { label: "今日待处理订单", value: "18", note: "含 6 笔待支付" },
  { label: "进行中团购", value: "4", note: "最近截单 18:00" },
  { label: "现货库存预警", value: "3", note: "需要补货确认" },
] as const

const queueItems = [
  { title: "SAST 周边补给包", status: "待确认", owner: "运营组" },
  { title: "实验室饮品补给", status: "待拣货", owner: "值班同学" },
  { title: "社团贴纸套装", status: "待上架", owner: "设计组" },
] as const

export default async function Home() {
  const currentUserResult = await loadCurrentUser()
  const pendingPaymentMeta = getOrderStatusMeta("pending_payment")
  const user = currentUserResult.user
  const displayName = user?.name ?? "运营同学"
  const department = user?.department ?? "SAST"
  const sourceStatus = desktopAppConfig.dataSourceFallback
    ? `配置值 ${desktopAppConfig.dataSourceFallback.providedValue} 已回退到 ${desktopAppConfig.dataSourceFallback.fallbackValue}`
    : `NEXT_PUBLIC_DATA_SOURCE=${desktopAppConfig.dataSource}`

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{desktopAppConfig.dataSource}</Badge>
            <Badge variant="outline">{pendingPaymentMeta.label}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            你好，{displayName}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            这里是 {department} 的商城桌面工作台，用于查看团购、现货、订单与发布状态。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="lg">
            导出订单
          </Button>
          <Button type="button" size="lg">
            发布商品
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-3xl leading-9">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-xl leading-7">处理队列</CardTitle>
                <CardDescription>按运营优先级排列的今日事项</CardDescription>
              </div>
              <Badge>{pendingPaymentMeta.tone}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {queueItems.map((item) => (
                <div
                  key={item.title}
                  className="grid min-h-16 grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-4 rounded-lg border border-border bg-background px-4"
                >
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.status}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.owner}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl leading-7">运行信息</CardTitle>
            <CardDescription>当前前端配置与后端接入状态</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">数据源</p>
              <p className="mt-1 break-words font-medium">{sourceStatus}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">应用地址</p>
              <p className="mt-1 break-words font-medium">
                {desktopAppConfig.appOrigin}
              </p>
            </div>
            {currentUserResult.error ? (
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="text-sm font-medium">用户信息暂未接入</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {currentUserResult.error}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
