import {
  getBuyerErrandOrderDetail,
  ResourceNotFoundError,
} from "@sast-shop/api"
import { notFound } from "next/navigation"

import { BuyerErrandOrderDetailView } from "@/components/buyer-errand-order-detail"
import { desktopAppConfig } from "@/lib/app-config"
import { parsePositiveInt64RouteId } from "@/lib/route-id"
import { getServerServiceOptions } from "@/lib/server-service-options"

export default async function BuyerErrandOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const id = parsePositiveInt64RouteId(rawId)
  if (!id) notFound()

  let order
  try {
    order = await getBuyerErrandOrderDetail(
      id,
      await getServerServiceOptions(),
    )
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound()
    throw error
  }

  return (
    <BuyerErrandOrderDetailView
      order={order}
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
    />
  )
}
