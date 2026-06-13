import {
  listErrandDemandStores,
  type ErrandDemandStoreSummary,
} from "@sast-shop/api"
import { ErrandDemandHall } from "@/components/errand-demand-hall"
import { mobileAppConfig } from "@/lib/app-config"

async function loadErrandDemandStores(): Promise<{
  demands: ErrandDemandStoreSummary[]
  error: string | null
}> {
  try {
    return {
      demands: await listErrandDemandStores({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      demands: [],
      error: "跑腿需求暂不可用，请确认 mock 服务或稍后再试",
    }
  }
}

export default async function ErrandDemandHallPage() {
  const result = await loadErrandDemandStores()

  return <ErrandDemandHall demands={result.demands} error={result.error} />
}
