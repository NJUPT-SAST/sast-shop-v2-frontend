import { cache } from "react"
import { getProfileOverview } from "@sast-shop/api"
import { mobileAppConfig } from "@/lib/app-config"

export const loadProfileOverview = cache(async () =>
  getProfileOverview({
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl: mobileAppConfig.connectBaseUrl,
  })
)
