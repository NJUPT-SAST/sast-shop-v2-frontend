import { listStores, type Store } from "@sast-shop/api"
import {
  RiFileAddLine,
  RiRunLine,
  RiStore2Line,
} from "@remixicon/react"
import Link from "next/link"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { ManagedImage } from "@/components/managed-image"
import { mobileAppConfig } from "@/lib/app-config"

async function loadStores(): Promise<{ stores: Store[]; error: string | null }> {
  try {
    return {
      stores: await listStores({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      stores: [],
      error: "店铺暂不可用，请稍后再试",
    }
  }
}

export default async function GroupPage() {
  const storeResult = await loadStores()
  const stores = storeResult.stores

  return (
    <div className="flex flex-1 flex-col gap-8 py-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold leading-7 md:text-2xl">团购</h1>

        {storeResult.error ? (
          <Card className="overflow-hidden rounded-lg p-1">
            <CardHeader className="gap-2">
              <CardTitle className="text-lg leading-6">店铺暂不可用</CardTitle>
              <CardDescription>{storeResult.error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-7 md:text-2xl">
              店铺
            </h2>
          </div>
        </div>

        {stores.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/group/shop/${store.id}`}
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <StoreCard store={store} />
              </Link>
            ))}
          </div>
        ) : !storeResult.error ? (
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="text-base">暂无店铺</CardTitle>
              <CardDescription>
                店铺上架后会显示在这里。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 md:text-2xl">补货</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-lg p-1">
            <CardHeader className="gap-3">
              <RiFileAddLine className="size-8 text-primary" />
              <div className="min-w-0">
                <CardTitle className="truncate text-base leading-5">
                  商品模板
                </CardTitle>
                <CardDescription>维护跑腿可选商品</CardDescription>
              </div>
            </CardHeader>
          </Card>
          <Card className="rounded-lg p-1">
            <CardHeader className="gap-3">
              <RiRunLine className="size-8 text-primary" />
              <div className="min-w-0">
                <CardTitle className="truncate text-base leading-5">
                  跑腿大厅
                </CardTitle>
                <CardDescription>接单、分发、收款</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  )
}

function StoreCard({ store }: { store: Store }) {
  return (
    <Card className="overflow-hidden rounded-lg border-0 bg-primary text-primary-foreground">
      <CardHeader className="min-h-36 justify-between">
        {store.logoUrl ? (
          <ManagedImage
            src={store.logoUrl}
            alt={store.name}
            className="size-11 rounded-md bg-primary-foreground/15 text-primary-foreground"
            imageClassName="p-2"
          />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-md bg-primary-foreground/15">
            <RiStore2Line className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <CardTitle className="truncate text-lg leading-6">
            {store.name}
          </CardTitle>
          <CardDescription className="truncate text-primary-foreground/80">
            {store.address}
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}
