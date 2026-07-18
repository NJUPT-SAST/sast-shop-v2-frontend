import { getProfileOverview, type ProfileOverview } from "@sast-shop/api";

import { ProfileManagement } from "@/components/profile-management";
import { desktopAppConfig } from "@/lib/app-config";
import { formatProfileOverviewError } from "@/lib/profile-view";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function ProfilePage() {
  const result = await loadProfileOverview();
  return (
    <ProfileManagement
      initialOverview={result.overview}
      error={result.error}
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
    />
  );
}

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null;
  error: string | null;
}> {
  try {
    return {
      overview: await getProfileOverview(await getServerServiceOptions()),
      error: null,
    };
  } catch {
    return { overview: null, error: formatProfileOverviewError() };
  }
}
