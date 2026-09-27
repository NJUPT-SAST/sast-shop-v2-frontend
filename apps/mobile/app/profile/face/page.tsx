import { PocketFacePage } from "@/components/west-pocket/pocket-face";
import { PocketProvider } from "@/components/west-pocket/shared";
import { mobileAppConfig } from "@/lib/app-config";
export default function FacePage() {
  return (
    <PocketProvider
      options={{
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }}
    >
      <PocketFacePage />
    </PocketProvider>
  );
}
