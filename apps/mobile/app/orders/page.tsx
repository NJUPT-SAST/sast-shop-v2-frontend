import { listSpotOrders } from "@sast-shop/api"
import { OrdersView } from "@/components/orders-view"
import { mobileAppConfig } from "@/lib/app-config"

async function getOrders() {
  try {
    return {
      spotOrders: await listSpotOrders({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      spotOrders: [],
      error: "订单暂不可用，请确认 mock 服务或稍后再试",
    }
  }
}

export default async function OrdersPage() {
  const result = await getOrders()

  return <OrdersView spotOrders={result.spotOrders} error={result.error} />
}
