import { ProfileManagement } from "@/components/profile-management";
import { desktopAppConfig } from "@/lib/app-config";
import { loadDesktopProfileOverview } from "@/lib/profile-overview";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function ProfilePage() {
  const result = await loadDesktopProfileOverview(
    await getServerServiceOptions(),
  );
  return (
    <ProfileManagement
      key={JSON.stringify(result)}
      initialOverview={result.overview}
      error={result.error}
      initialAddressError={result.addressError}
      initialQrError={result.qrError}
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      feedbackFormUrl={desktopAppConfig.feedbackFormUrl}
    />
  );
}
