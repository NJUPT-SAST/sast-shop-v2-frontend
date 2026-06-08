import { getProfileOverview, type ProfileOverview } from "@sast-shop/api"
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

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      overview: null,
      error: "个人资料暂不可用，请确认数据源或稍后再试",
    }
  }
}

export default async function ProfilePage() {
  const result = await loadProfileOverview()
  const overview = result.overview
  const defaultAddress = overview?.defaultAddress ?? null

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">我的</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">
            个人资料
          </h1>
        </div>
        <Badge variant="muted" className="shrink-0">
          {mobileAppConfig.dataSource}
        </Badge>
      </section>

      {result.error ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg leading-6">资料暂不可用</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {overview ? (
        <>
          <Card className="rounded-lg">
            <CardHeader>
              <CardDescription>当前用户</CardDescription>
              <CardTitle className="break-words text-xl leading-7">
                {overview.user.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all text-sm leading-6 text-muted-foreground">
                用户 ID：{overview.user.id}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-lg leading-6">
                    默认地址
                  </CardTitle>
                  <CardDescription className="mt-1 break-words">
                    {defaultAddress
                      ? `${defaultAddress.recipientName} ${defaultAddress.recipientPhone}`
                      : "还没有默认地址"}
                  </CardDescription>
                </div>
                {defaultAddress ? (
                  <Badge className="shrink-0">默认</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="break-words text-sm leading-6 text-muted-foreground">
                {defaultAddress
                  ? formatAddress(defaultAddress)
                  : "添加常用地址后，下单时会更顺手。"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 self-start"
                disabled
                aria-label="请使用底部地址簿入口查看地址"
                title="请使用底部地址簿入口查看地址"
              >
                底部地址簿可查看
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-lg leading-6">收款码</CardTitle>
              <CardDescription>
                已配置 {overview.paymentQrCodes.length} 个渠道
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {overview.paymentQrCodes.length > 0 ? (
                  overview.paymentQrCodes.map((qrCode) => (
                    <Badge key={qrCode.id} variant="outline">
                      {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="muted">暂无渠道</Badge>
                )}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                使用底部全局入口管理地址簿和快捷收款码。当前页面只展示资料概览。
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function formatAddress(address: NonNullable<ProfileOverview["defaultAddress"]>) {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`
}
