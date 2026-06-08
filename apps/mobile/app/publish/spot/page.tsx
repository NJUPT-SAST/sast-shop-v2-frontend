import { listProductTemplates } from "@sast-shop/api"
import { PublishSpotForm } from "@/components/publish-spot-form"
import { mobileAppConfig } from "@/lib/app-config"

async function getTemplates() {
  try {
    return {
      templates: await listProductTemplates({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch {
    return {
      templates: [],
      error: "商品模板暂不可用，请确认 mock 服务或稍后再试",
    }
  }
}

export default async function PublishSpotPage() {
  const result = await getTemplates()

  return (
    <PublishSpotForm
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      templates={result.templates}
      error={result.error}
    />
  )
}
