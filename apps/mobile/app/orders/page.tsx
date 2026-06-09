import { listBuyerErrandOrders, listSpotOrders } from "@sast-shop/api"
import { OrdersView } from "@/components/orders-view"
import { mobileAppConfig } from "@/lib/app-config"

async function getOrders() {
  const options = {
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl: mobileAppConfig.connectBaseUrl,
  }
  const [spotResult, buyerErrandResult] = await Promise.allSettled([
    listSpotOrders(options),
    listBuyerErrandOrders(options),
  ])
  const spotOrders =
    spotResult.status === "fulfilled" ? spotResult.value : []
  const buyerErrandOrders =
    buyerErrandResult.status === "fulfilled" ? buyerErrandResult.value : []
  const spotFailed = spotResult.status === "rejected"
  const buyerErrandFailed = buyerErrandResult.status === "rejected"

  let error: string | null = null
  if (spotFailed && buyerErrandFailed) {
    error = "订单暂不可用，请稍后重试"
  } else if (spotFailed) {
    error = "部分订单暂不可用，现货订单请稍后查看"
  } else if (buyerErrandFailed) {
    error = "部分订单暂不可用，跑腿订单请稍后查看"
  }

  return {
    spotOrders,
    buyerErrandOrders,
    error,
  }
}

export default async function OrdersPage() {
  const result = await getOrders()

  return (
    <OrdersView
      spotOrders={result.spotOrders}
      buyerErrandOrders={result.buyerErrandOrders}
      error={result.error}
    />
  )
}
