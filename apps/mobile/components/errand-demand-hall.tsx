"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowRightSLine,
  RiSearchLine,
  RiStore2Line,
  RiUser3Line,
} from "@remixicon/react";
import {
  listErrandDemandStoresPage,
  type DataSource,
  type ErrandDemandStoreSummary,
  type PageResult,
} from "@sast-shop/api";
import Link from "next/link";
import Image from "next/image";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { Input } from "@workspace/ui/components/input";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";

import { formatErrandDisplayPrice } from "@/lib/errand-display";
import { sanitizeImageSrc } from "@/lib/image-src";
import { isValidRouteId } from "@/lib/route-id";
import errandEmpty from "../public/brand/errand-empty.webp";

type ErrandDemandHallProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  initialPage: PageResult<ErrandDemandStoreSummary>;
  error: string | null;
};

const updatedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function ErrandDemandHall({
  dataSource,
  connectBaseUrl,
  initialPage,
  error,
}: ErrandDemandHallProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasKeyword = Boolean(keyword.trim());
  const loadPage = useCallback(
    (page: number) =>
      listErrandDemandStoresPage({
        dataSource,
        connectBaseUrl,
        page,
        pageSize: initialPage.pageSize,
      }),
    [connectBaseUrl, dataSource, initialPage.pageSize],
  );
  const {
    items: demands,
    loadingMore,
    loadMoreError,
    hasMore,
    totalCount,
    loadMore,
  } = useInfinitePage({
    initialPage,
    loadPage,
    getKey: getDemandKey,
    identity: `${dataSource}:${connectBaseUrl}`,
  });

  const filteredDemands = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) {
      return demands;
    }

    return demands.filter((demand) =>
      demand.storeName.toLowerCase().includes(value),
    );
  }, [demands, keyword]);

  useEffect(() => {
    if (!hasKeyword || !hasMore || loadMoreError) return;
    const timeout = window.setTimeout(() => void loadMore(), 250);
    return () => window.clearTimeout(timeout);
  }, [hasKeyword, hasMore, loadMore, loadMoreError]);

  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section>
        <h1 className="text-xl font-semibold leading-7 md:text-2xl">
          跑腿采购大厅
        </h1>
      </section>

      <label className="relative block">
        <span className="sr-only">搜索店铺名称</span>
        <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
          placeholder="搜索店铺名称"
          autoComplete="off"
          className="rounded-lg pl-9"
        />
      </label>

      {error ? (
        <LoadFailure
          title="跑腿需求加载失败"
          description={error}
          onRetry={() => router.refresh()}
        />
      ) : filteredDemands.length > 0 ? (
        <section className="flex flex-col gap-3">
          {filteredDemands.map((demand) => (
            <DemandCard key={demand.storeId} demand={demand} />
          ))}
        </section>
      ) : !loadingMore && !hasMore ? (
        <Empty
          icon={hasKeyword ? <RiStore2Line className="size-5" /> : undefined}
          illustration={
            !hasKeyword ? (
              <Image
                src={errandEmpty}
                width={128}
                height={128}
                alt=""
                aria-hidden="true"
                unoptimized
                className="size-32 object-contain"
              />
            ) : undefined
          }
          title={hasKeyword ? "没有匹配的店铺需求" : "暂无待接单需求"}
          description={hasKeyword ? "请尝试其他店铺名称。" : undefined}
          action={
            hasKeyword ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setKeyword("");
                  window.requestAnimationFrame(() =>
                    searchInputRef.current?.focus(),
                  );
                }}
              >
                清空搜索
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!error ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={loadingMore}
          error={loadMoreError}
          hasItems={totalCount > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<DemandLoadingSkeletons />}
          endMessage={`已经到底，共 ${demands.length} 个店铺需求`}
          endMessageClassName="pt-6"
        />
      ) : null}
    </div>
  );
}

function DemandLoadingSkeletons() {
  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label="正在加载更多跑腿需求"
    >
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="h-4 w-2/5" />
              </div>
            </div>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto size-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getDemandKey(demand: ErrandDemandStoreSummary) {
  return demand.storeId;
}

function DemandCard({ demand }: { demand: ErrandDemandStoreSummary }) {
  const goodsSubtotal = demand.totalOriginUnitPriceCents;
  const serviceFee = demand.totalServiceFeeCents;
  const total = goodsSubtotal + serviceFee;
  const updatedLabel = formatUpdatedAt(demand.updatedAt);
  const card = (
    <Card className="rounded-lg transition-colors hover:border-primary/40">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <RiStore2Line className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-base leading-6">
              {demand.storeName}
            </CardTitle>
            {updatedLabel ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {updatedLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs leading-5 text-muted-foreground">预估合计</p>
          <p className="text-lg font-semibold leading-6 text-primary">
            {formatErrandDisplayPrice(total)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-primary">
            商品小计 {formatErrandDisplayPrice(goodsSubtotal)}
          </Badge>
          <Badge variant="muted" className="text-service-fee">
            跑腿费 {formatErrandDisplayPrice(serviceFee)}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ParticipantAvatars avatars={demand.participantAvatars} />
            <span className="truncate text-sm text-muted-foreground">
              {demand.participantAvatars.length > 0
                ? "已有成员参与"
                : "暂无参与人"}
            </span>
          </div>

          {isValidRouteId(demand.storeId) ? (
            <RiArrowRightSLine className="size-5 shrink-0 text-muted-foreground" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!isValidRouteId(demand.storeId)) {
    return <div className="rounded-lg opacity-70">{card}</div>;
  }

  return (
    <Link
      href={`/group/errand/${demand.storeId}`}
      prefetch={false}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  );
}

function ParticipantAvatars({ avatars }: { avatars: string[] }) {
  const visibleAvatars = avatars.slice(0, 3);

  if (visibleAvatars.length === 0) {
    return null;
  }

  return (
    <div className="flex -space-x-2">
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={`${avatar}-${index}`}
          className="size-7 border-2 border-card"
        >
          <AvatarImage src={sanitizeImageSrc(avatar) ?? undefined} alt="" />
          <AvatarFallback>
            <RiUser3Line className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `更新于 ${updatedAtFormatter.format(date)}`;
}
