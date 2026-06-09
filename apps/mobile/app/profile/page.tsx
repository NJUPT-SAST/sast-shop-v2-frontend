import type { ProfileOverview } from "@sast-shop/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { loadProfileOverview } from "@/lib/profile-overview"
import { ProfileManagement } from "@/components/profile-management"

async function getProfilePageOverview(): Promise<{
  overview: ProfileOverview | null
  error: string | null
}> {
  try {
    return {
      overview: await loadProfileOverview(),
      error: null,
    }
  } catch {
    return {
      overview: null,
      error: "个人资料暂不可用，请确认数据源或稍后再试",
    }
  }
}

export default async function ProfilePage() {
  const result = await getProfilePageOverview()
  const overview = result.overview

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold md:text-2xl">我的</h1>

      {result.error ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg leading-6">资料暂不可用</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {overview ? (
        <Card className="rounded-lg">
          <CardContent className="flex items-center gap-3 p-4">
            <Avatar className="size-12">
              <AvatarImage
                src={overview.user.avatarUrl}
                alt={overview.user.name}
              />
              <AvatarFallback className="text-lg font-semibold">
                {overview.user.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="min-w-0 break-words text-xl leading-7">
              {overview.user.name}
            </CardTitle>
          </CardContent>
        </Card>
      ) : null}

      <ProfileManagement />
    </div>
  )
}
