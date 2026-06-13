import { getCollectingPaymentDetail } from "@sast-shop/api"

import { CollectingPaymentView } from "@/components/errand-purchase/collecting-payment-view"
import { mobileAppConfig } from "@/lib/app-config"

type GroupPurchasePaymentPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function GroupPurchasePaymentPage({
  params,
}: GroupPurchasePaymentPageProps) {
  const { id } = await params
  const serviceOptions = {
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl: mobileAppConfig.connectBaseUrl,
  }

  const detail = await getCollectingPaymentDetail(id, serviceOptions)

  return (
    <CollectingPaymentView
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      detail={detail}
      taskId={id}
    />
  )
}
