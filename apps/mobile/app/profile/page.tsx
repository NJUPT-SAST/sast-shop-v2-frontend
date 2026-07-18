import type { ProfileOverview } from "@sast-shop/api";
import Link from "next/link";
import { RiRefreshLine } from "@remixicon/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { loadProfileOverview } from "@/lib/profile-overview";
import { ProfileManagement } from "@/components/profile-management";

async function getProfilePageOverview(): Promise<{
  overview: ProfileOverview | null;
  error: string | null;
}> {
  try {
    return {
      overview: await loadProfileOverview(),
      error: null,
    };
  } catch {
    return {
      overview: null,
      error: "个人资料暂不可用，请稍后再试",
    };
  }
}

export default async function ProfilePage() {
  const result = await getProfilePageOverview();
  const overview = result.overview;

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold md:text-2xl">我的</h1>

      {result.error ? (
        <Card className="rounded-lg">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base leading-6">资料加载失败</CardTitle>
            <Button asChild size="icon-touch" variant="ghost">
              <Link href="/profile" aria-label="重新加载个人资料">
                <RiRefreshLine />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      ) : null}

      {overview ? (
        <div className="flex items-center gap-3 px-1">
          <Avatar className="size-12">
            <AvatarImage
              src={overview.user.avatarUrl}
              alt={overview.user.name}
            />
            <AvatarFallback className="text-lg font-semibold">
              {overview.user.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 break-words text-xl font-semibold leading-7">
            {overview.user.name}
          </p>
        </div>
      ) : null}

      <ProfileManagement />
    </div>
  );
}
