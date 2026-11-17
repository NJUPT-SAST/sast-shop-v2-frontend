import { PublishSpotForm } from "@/components/publish-spot-form";
import { desktopAppConfig } from "@/lib/app-config";

export default function PublishSpotPage() {
  return (
    <PublishSpotForm
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
    />
  );
}
