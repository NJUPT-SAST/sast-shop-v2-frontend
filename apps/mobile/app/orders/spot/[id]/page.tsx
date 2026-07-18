import { getSpotOrderDetail, ResourceNotFoundError } from "@sast-shop/api"
import { notFound } from "next/navigation"

import { SpotOrderDetail } from "@/components/spot-order-detail"
import { mobileAppConfig } from "@/lib/app-config"
import { isValidRouteId } from "@/lib/route-id"
import { getServerServiceOptions } from "@/lib/server-service-options"
import { parseSpotOrderView } from "@/lib/spot-order-route"

type SpotOrderPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    view?: string
  }>
}

export default async function SpotOrderPage({
  params,
  searchParams
}: SpotOrderPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const view = parseSpotOrderView(query.view ?? null)

  if (!isValidRouteId(id)) {
    notFound()
  }

  let order

  try {
    order = await getSpotOrderDetail(id, await getServerServiceOptions())
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      notFound()
    }

    throw error
  }

  return (
    <SpotOrderDetail
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      order={order}
      view={view}
    />
  )
}
