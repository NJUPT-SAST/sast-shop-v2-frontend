import { getProfileOverview, type ProfileOverview } from "@sast-shop/api"
import { mobileAppConfig } from "@/lib/app-config"
import { ProfileManagementClient } from "./profile-management-client"

async function loadProfileOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await getProfileOverview({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      error: null,
    }
  } catch (error) {
    return {
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : "资料管理暂不可用，请稍后再试",
    }
  }
}

export async function ProfileManagement() {
  const result = await loadProfileOverview()

  return (
    <ProfileManagementClient
      dataSource={mobileAppConfig.dataSource}
      overview={result.overview}
      error={result.error}
    />
  )
}
