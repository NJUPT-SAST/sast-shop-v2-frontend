import { mobileAppConfig } from "@/lib/app-config"
import { loadProfileOverview } from "@/lib/profile-overview"
import { ProfileManagementClient } from "./profile-management-client"

async function getProfileManagementOverview() {
  try {
    return {
      overview: await loadProfileOverview(),
      error: null,
    }
  } catch {
    return {
      overview: null,
      error: "资料管理暂不可用，请确认数据源或稍后再试",
    }
  }
}

export async function ProfileManagement() {
  const result = await getProfileManagementOverview()

  return (
    <ProfileManagementClient
      dataSource={mobileAppConfig.dataSource}
      overview={result.overview}
      error={result.error}
    />
  )
}
