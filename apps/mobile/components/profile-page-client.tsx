"use client";

import { type DataSource } from "@sast-shop/api";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { LoadFailure } from "@/components/load-failure";
import { ProfileManagement } from "@/components/profile-management";
import { loadCurrentUser } from "@/lib/current-user";

export function ProfilePageClient({
  dataSource,
  connectBaseUrl,
  feedbackFormUrl,
  authRequired,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  feedbackFormUrl: string | null;
  authRequired: boolean;
  refreshKey: string;
}) {
  const resource = useCachedResource({
    cacheKey: `profile:user:${JSON.stringify([dataSource, connectBaseUrl, authRequired])}`,
    load: () => loadCurrentUser({ dataSource, connectBaseUrl }, authRequired),
    staleTime: Infinity,
    invalidateOnWrite: false,
    refreshKey,
  });
  const user = resource.data;

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <h1 className="text-xl font-semibold md:text-2xl">我的</h1>

      {resource.error ? (
        <LoadFailure
          variant="compact"
          title="资料加载失败"
          description="个人资料暂不可用，请稍后再试"
          onRetry={() => void resource.refresh()}
        />
      ) : null}

      {resource.loading && !user ? (
        <div
          className="flex items-center gap-3 px-1"
          role="status"
          aria-label="正在加载个人资料"
        >
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-7 w-28" />
        </div>
      ) : user ? (
        <div className="flex items-center gap-3 px-1">
          <Avatar className="size-12">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className="text-lg font-semibold">
              {user.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 break-words text-xl font-semibold leading-7">
            {user.name}
          </p>
        </div>
      ) : null}

      <ProfileManagement feedbackFormUrl={feedbackFormUrl} />
    </div>
  );
}
