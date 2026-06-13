import {
  getErrandDemandDetails,
  listStores,
  type ErrandDemandDetailGroup,
} from "@sast-shop/api"
import { RiStore2Line } from "@remixicon/react"
import { Empty } from "@workspace/ui/components/empty"

import { ErrandDemandDetail } from "@/components/errand-demand-detail"
import { mobileAppConfig } from "@/lib/app-config"

type ErrandDemandDetailPageProps = {
  params: Promise<{
    storeId: string
  }>
}

type DemandDetailResult = {
  details: ErrandDemandDetailGroup[]
  storeName: string
  error: string | null
}

async function loadDemandDetails(storeId: string): Promise<DemandDetailResult> {
  try {
    const details = await getErrandDemandDetails(
      { storeId },
      {
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }
    )
    const stores = await listStores({
      dataSource: mobileAppConfig.dataSource,
      connectBaseUrl: mobileAppConfig.connectBaseUrl,
    }).catch(() => [])

    return {
      details,
      storeName:
        stores.find((store) => store.id === storeId)?.name ?? "店铺需求",
      error: null,
    }
  } catch {
    return {
      details: [],
      storeName: "店铺需求",
      error: "跑腿需求详情暂不可用，请稍后再试",
    }
  }
}

export default async function ErrandDemandDetailPage({
  params,
}: ErrandDemandDetailPageProps) {
  const { storeId } = await params
  const { details, storeName, error } = await loadDemandDetails(storeId)

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="需求详情暂不可用"
          description={error}
        />
      </div>
    )
  }

  return (
    <ErrandDemandDetail
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      storeId={storeId}
      storeName={storeName}
      details={details}
    />
  )
}
