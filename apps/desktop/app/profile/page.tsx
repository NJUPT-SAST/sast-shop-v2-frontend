import { getProfileOverview, type ProfileOverview } from "@sast-shop/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { getServerServiceOptions } from "@/lib/server-service-options";
import { formatProfileOverviewError } from "@/lib/profile-view";

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null;
  error: string | null;
}> {
  try {
    return {
      overview: await getProfileOverview(await getServerServiceOptions()),
      error: null,
    };
  } catch {
    return {
      overview: null,
      error: formatProfileOverviewError(),
    };
  }
}

export default async function ProfilePage() {
  const result = await loadProfileOverview();
  const overview = result.overview;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-start justify-between gap-6">
        <h1 className="text-3xl font-semibold leading-tight">我的资料</h1>
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
            <CardContent className="flex items-center gap-4 p-6">
              <Avatar className="size-14">
                <AvatarImage
                  src={overview.user.avatarUrl}
                  alt={overview.user.name}
                />
                <AvatarFallback className="text-xl font-semibold">
                  {overview.user.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="min-w-0 break-words text-2xl leading-8">
                {overview.user.name}
              </CardTitle>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl leading-7">收款码</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.paymentQrCodes.length > 0 ? (
                overview.paymentQrCodes.map((qrCode) => (
                  <div
                    key={qrCode.id}
                    className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-border px-4"
                  >
                    <p className="font-medium">
                      {qrCode.channel === "wechat" ? "微信支付" : "支付宝"}
                    </p>
                    <Badge variant="success">已上传</Badge>
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
                <p className="text-sm text-muted-foreground">暂无地址</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function formatAddress(address: ProfileOverview["addresses"][number]): string {
  return `${address.province}${address.city}${address.district}${address.detailAddress}`;
}
