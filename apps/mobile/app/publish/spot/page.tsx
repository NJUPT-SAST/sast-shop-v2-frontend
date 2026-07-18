import { PublishSpotForm } from "@/components/publish-spot-form"
import { mobileAppConfig } from "@/lib/app-config"

export default function PublishSpotPage() {
  return (
    <PublishSpotForm
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
    />
  )
}
