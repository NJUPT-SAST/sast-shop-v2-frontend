"use client";

import { RiUser3Line } from "@remixicon/react";
import { Avatar, AvatarFallback, AvatarImage } from "#components/avatar";
import { Button } from "#components/button";
import { Skeleton } from "#components/skeleton";
import { useCachedResource } from "#hooks/use-cached-resource";

const startTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function ErrandTaskStartTime({ value }: { value: string | null }) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      开始时间 <time dateTime={value}>{startTimeFormatter.format(date)}</time>
    </p>
  );
}

export function ErrandTaskParticipants({
  cacheKey,
  load,
  refreshKey,
}: {
  cacheKey: string;
  load: () => Promise<{
    participantCount: number;
    participantAvatars: string[];
  }>;
  refreshKey: object;
}) {
  const resource = useCachedResource({
    cacheKey,
    load,
    refreshKey,
    staleTime: 30_000,
  });

  if (!resource.data && !resource.error) {
    return (
      <div
        className="flex -space-x-2"
        role="status"
        aria-label="正在加载拼单人"
      >
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            className="size-7 rounded-full border-2 border-card"
          />
        ))}
      </div>
    );
  }
  if (!resource.data) {
    return (
      <Button
        variant="text"
        size="sm"
        className="relative z-10"
        onClick={() => void resource.refresh()}
      >
        重试头像
      </Button>
    );
  }
  const { participantCount, participantAvatars } = resource.data;
  if (participantCount === 0) return null;
  const visibleCount = Math.min(participantCount, 3);
  return (
    <div
      className="flex items-center -space-x-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      aria-label={`${participantCount} 人拼单`}
    >
      {Array.from({ length: visibleCount }, (_, index) => (
        <Avatar key={index} className="size-7 border-2 border-card">
          <AvatarImage
            src={sanitizeAvatarUrl(participantAvatars[index])}
            alt=""
          />
          <AvatarFallback>
            <RiUser3Line className="size-3.5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      ))}
      {participantCount > visibleCount ? (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-card bg-muted px-1 text-xs tabular-nums text-muted-foreground">
          +{participantCount - visibleCount}
        </span>
      ) : null}
    </div>
  );
}

function sanitizeAvatarUrl(value: string | undefined) {
  const src = value?.trim();
  return src && /^(https?:\/\/|\/(?!\/)|data:image\/|blob:)/.test(src)
    ? src
    : undefined;
}

export function getErrandTaskProgress(task: {
  itemCount: number;
  items: { requiredQuantity: number; purchasedQuantity: number | null }[];
}) {
  const required = task.items.reduce(
    (total, item) => total + item.requiredQuantity,
    0,
  );
  if (required === 0) return `${task.itemCount} 种商品`;
  const purchased = task.items.reduce(
    (total, item) => total + Math.max(0, item.purchasedQuantity ?? 0),
    0,
  );
  return `已采购 ${purchased}/${required} 件`;
}
