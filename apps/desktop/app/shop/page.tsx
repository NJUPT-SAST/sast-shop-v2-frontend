import { listSpotGoods, type SpotGoods } from "@sast-shop/api"

import { SpotMarketplace } from "@/components/spot-marketplace"
import { desktopAppConfig } from "@/lib/app-config"
import { getServerServiceOptions } from "@/lib/server-service-options"

export default async function ShopPage() {
  const options = await getServerServiceOptions()
  let goods: SpotGoods[] = []
  let errorMessage: string | null = null
  try {
    goods = await listSpotGoods(options)
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "请稍后重试"
  }
  return <SpotMarketplace dataSource={desktopAppConfig.dataSource} connectBaseUrl={desktopAppConfig.connectBaseUrl} goods={goods} error={errorMessage} />
}
