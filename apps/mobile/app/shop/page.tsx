import { listSpotGoods } from "@sast-shop/api"
import { SpotMarketplace } from "@/components/spot-marketplace"
import { mobileAppConfig } from "@/lib/app-config"
import { getServerServiceOptions } from "@/lib/server-service-options"

async function getSpotGoods() {
  try {
    const options = await getServerServiceOptions()
    return {
      goods: await listSpotGoods(options),
      error: null,
    }
  } catch {
    return {
      goods: [],
      error: "现货商品暂不可用，请确认 mock 服务或稍后再试",
    }
  }
}

export default async function ShopPage() {
  const result = await getSpotGoods()

  return (
    <SpotMarketplace
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      products={result.goods}
      error={result.error}
    />
  )
}
