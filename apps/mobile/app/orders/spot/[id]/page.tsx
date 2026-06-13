import { listSpotOrders } from "@sast-shop/api"
import { RiShoppingBag3Line } from "@remixicon/react"
import { Empty } from "@workspace/ui/components/empty"
import { notFound } from "next/navigation"

import { SpotOrderDetail } from "@/components/spot-order-detail"
import { mobileAppConfig } from "@/lib/app-config"

type SpotOrderPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function SpotOrderPage({ params }: SpotOrderPageProps) {
  const { id } = await params

  let order = null
  let errorMessage: string | null = null

  try {
    const orders = await listSpotOrders({
      dataSource: mobileAppConfig.dataSource,
      connectBaseUrl: mobileAppConfig.connectBaseUrl,
    })
    order = orders.find((o) => o.id === id) ?? null
  } catch {
    errorMessage = "加载订单失败，请稍后再试"
  }

  if (errorMessage) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <Empty
          icon={<RiShoppingBag3Line className="size-5" />}
          title="加载失败"
          description={errorMessage}
        />
      </div>
    )
  }

  if (!order) {
    notFound()
  }

  return (
    <SpotOrderDetail
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      order={order}
    />
  )
}
