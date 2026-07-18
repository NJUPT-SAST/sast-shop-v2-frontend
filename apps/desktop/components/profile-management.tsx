import { getProfileOverview, type ProfileOverview } from "@sast-shop/api"
import { desktopAppConfig } from "@/lib/app-config"
import { formatProfileOverviewError } from "@/lib/profile-view"
import { getServerServiceOptions } from "@/lib/server-service-options"
import { ProfileManagementClient } from "./profile-management-client"

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await getProfileOverview(await getServerServiceOptions()),
      error: null,
    }
  } catch {
    return {
      overview: null,
      error: formatProfileOverviewError(),
    }
  }
}

export async function ProfileManagement() {
  const result = await loadProfileOverview()

  return (
    <ProfileManagementClient
      dataSource={desktopAppConfig.dataSource}
      overview={result.overview}
      error={result.error}
    />
  )
}
