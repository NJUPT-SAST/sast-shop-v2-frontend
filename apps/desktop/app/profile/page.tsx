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
import { desktopAppConfig } from "@/lib/app-config"
import {
  formatProfileDataSource,
  formatProfileOverviewError,
} from "@/lib/profile-view"

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: desktopAppConfig.dataSource,
        connectBaseUrl: desktopAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      overview: null,
      error: formatProfileOverviewError(),
    }
  }
}

export default async function ProfilePage() {
  const result = await loadProfileOverview()
  const overview = result.overview

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">
              {formatProfileDataSource(desktopAppConfig.dataSource)}
            </Badge>
            <Badge variant="outline">资料管理</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            个人资料
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            管理地址簿与收款码，为后续订单支付和确认收款做准备。
          </p>
        </div>
      </section>

      {result.error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl leading-7">资料暂不可用</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {overview ? (
        <section className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4">
          <Card>
            <CardHeader>
              <CardDescription>当前用户</CardDescription>
              <CardTitle className="break-words text-2xl leading-8">
                {overview.user.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all text-sm text-muted-foreground">
                用户 ID：{overview.user.id}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl leading-7">收款码</CardTitle>
              <CardDescription>微信与支付宝收款信息</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.paymentQrCodes.length > 0 ? (
                overview.paymentQrCodes.map((qrCode) => (
                  <div
                    key={qrCode.id}
                    className="grid min-h-14 grid-cols-[8rem_minmax(0,1fr)_7rem] items-center gap-4 rounded-lg border border-border px-4"
                  >
                    <p className="font-medium">
                      {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {qrCode.content}
                    </p>
                    <Button type="button" variant="outline" size="sm" disabled>
                      编辑待开放
                    </Button>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
                  暂无收款码。配置后可用于后续支付确认流程。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader>
              <CardTitle className="text-xl leading-7">地址簿</CardTitle>
              <CardDescription>常用收货地址与默认地址</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.addresses.length > 0 ? (
                overview.addresses.map((address) => (
                  <div
                    key={address.id}
                    className="grid min-h-16 grid-cols-[8rem_8rem_minmax(0,1fr)_5rem] items-center gap-4 rounded-lg border border-border px-4"
                  >
                    <p className="truncate font-medium">
                      {address.recipientName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {address.recipientPhone}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatAddress(address)}
                    </p>
                    {address.isDefault ? <Badge>默认</Badge> : <span />}
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">
                  暂无地址。添加常用地址后，下单和跑腿需求会更容易核对。
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

function formatAddress(address: ProfileOverview["addresses"][number]): string {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`
}
