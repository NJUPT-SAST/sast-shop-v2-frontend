import { getCurrentUser } from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { mobileAppConfig } from "@/lib/app-config"

async function loadCurrentUser() {
  try {
    return await getCurrentUser({ dataSource: mobileAppConfig.dataSource })
  } catch {
    return null
  }
}

export default async function Home() {
  const user = await loadCurrentUser()
  const samplePrice = formatPrice(1299)
  const displayName = user?.name ?? "同学"
  const department = user?.department ?? "SAST"

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-none py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">你好，{displayName}</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">
              今天看看社团好物
            </h1>
          </div>
          <Badge variant="muted" className="shrink-0">
            {mobileAppConfig.dataSource}
          </Badge>
        </div>
      </section>

      <Card className="overflow-hidden rounded-lg">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl leading-7">午间团购</CardTitle>
            <Badge>进行中</Badge>
          </div>
          <CardDescription>
            {department} 专属示例商品，当前价格 {samplePrice}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex min-h-32 items-end rounded-lg border border-border bg-muted p-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">预计 18:00 截单</p>
              <p className="mt-1 text-2xl font-semibold leading-8">
                SAST 周边补给包
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">数据源</p>
              <p className="truncate font-medium">
                NEXT_PUBLIC_DATA_SOURCE={mobileAppConfig.dataSource}
              </p>
            </div>
            <Button type="button" size="lg" className="min-h-11 shrink-0 px-6">
              加入
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base leading-5">现货</CardTitle>
            <CardDescription>饮品与耗材</CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base leading-5">订单</CardTitle>
            <CardDescription>待取 0 件</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
