"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
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
import { formatErrandDisplayCount, formatPrice } from "@sast-shop/domain";
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
import { LoadFailure } from "@workspace/ui/components/load-failure";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";

import { parsePositiveInt64RouteId } from "@/lib/route-id";

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
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  initialPage: PageResult<ErrandDemandStoreSummary>;
  error: string | null;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const storeName = keyword.trim();
  const [debouncedStoreName, setDebouncedStoreName] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedStoreName(storeName),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [storeName]);
  const search = useCachedResource({
    cacheKey: JSON.stringify([
      "desktop:errand-lobby-search",
      dataSource,
      connectBaseUrl,
      initialPage.pageSize,
      debouncedStoreName,
    ]),
    staleTime: 30_000,
    refreshKey: initialPage,
    load: () =>
      debouncedStoreName
        ? listErrandDemandStoresPage({
            dataSource,
            connectBaseUrl,
            page: 1,
            pageSize: initialPage.pageSize,
            storeName: debouncedStoreName,
          })
        : Promise.resolve(initialPage),
  });
  const searching =
    Boolean(storeName) && (storeName !== debouncedStoreName || !search.data);
  const searchError =
    storeName === debouncedStoreName && storeName && search.error
      ? "搜索暂不可用，请稍后重试"
      : null;
  const displayError = storeName ? searchError : error;
  const resultPage = storeName ? search.data : initialPage;
  const firstPage = useMemo(
    () =>
      !searching && resultPage
        ? resultPage
        : {
            items: [],
            currentPage: 1,
            pageSize: initialPage.pageSize,
            totalCount: 0,
            hasMore: false,
          },
    [initialPage.pageSize, resultPage, searching],
  );
  const loadPage = useCallback(
    (page: number) =>
      listErrandDemandStoresPage({
        dataSource,
        connectBaseUrl,
        page,
        pageSize: initialPage.pageSize,
        storeName,
      }),
    [connectBaseUrl, dataSource, initialPage.pageSize, storeName],
  );
  const {
    items: demands,
    loadingMore,
    loadMoreError,
    hasMore,
    totalCount,
    loadMore,
  } = useInfinitePage({
    initialPage: firstPage,
    loadPage,
    getKey: getDemandKey,
    identity: JSON.stringify([dataSource, connectBaseUrl, storeName]),
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">跑腿采购大厅</h1>
        <Button asChild variant="outline">
          <Link href="/group">
            <RiArrowLeftLine data-icon="inline-start" />
            返回团购工作台
          </Link>
        </Button>
      </section>

      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <RiSearchLine />
        </InputGroupAddon>
        <InputGroupInput
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索店铺名称"
          aria-label="搜索店铺名称"
        />
      </InputGroup>

      {displayError ? (
        <LoadFailure
          title="跑腿需求加载失败"
          description={displayError}
          onRetry={() => {
            if (storeName) void search.refresh();
            else router.refresh();
          }}
        />
      ) : searching ? (
        <DemandLoadingSkeletons />
      ) : demands.length === 0 && !loadingMore && !hasMore ? (
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title={keyword.trim() ? "没有匹配的店铺需求" : "暂无待接单需求"}
          action={
            keyword.trim() ? (
              <Button variant="outline" onClick={() => setKeyword("")}>
                清空搜索
              </Button>
            ) : undefined
          }
        />
      ) : demands.length > 0 ? (
        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          {demands.map((demand) => (
            <DemandCard key={demand.storeId} demand={demand} />
          ))}
        </section>
      ) : null}

      {!displayError && !searching ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={loadingMore}
          error={loadMoreError}
          hasItems={totalCount > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<DemandLoadingSkeletons />}
          endMessage={`已经到底，共 ${demands.length} 个店铺需求`}
        />
      ) : null}
    </div>
  );
}

function DemandLoadingSkeletons() {
  return (
    <div
      className="grid min-w-0 gap-4 lg:grid-cols-2"
      aria-label="正在加载更多跑腿需求"
    >
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardHeader className="flex-row items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
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
  const id = parsePositiveInt64RouteId(demand.storeId);
  const goodsSubtotal = demand.totalOriginUnitPriceCents;
  const serviceFee = demand.totalServiceFeeCents;
  const total = goodsSubtotal + serviceFee;
  const updatedLabel = formatUpdatedAt(demand.updatedAt);
  const content = (
    <Card className="h-full min-w-0 transition-colors group-hover:border-primary/40">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <RiStore2Line className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {demand.storeName}
            </CardTitle>
            {updatedLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {updatedLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">预计合计</p>
          <p className="mt-1 text-lg font-semibold text-primary">
            {formatPrice(total)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">商品 {formatPrice(goodsSubtotal)}</Badge>
          <Badge variant="muted">跑腿费 {formatPrice(serviceFee)}</Badge>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4 border-t pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <ParticipantAvatars avatars={demand.participantAvatars} />
            <span className="truncate text-sm text-muted-foreground">
              {formatErrandDisplayCount(demand.participantAvatars.length)}{" "}
              人参与
            </span>
          </div>
          {id ? (
            <RiArrowRightSLine className="size-5 shrink-0 text-muted-foreground" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!id) return <div className="opacity-60">{content}</div>;

  return (
    <Link
      href={`/group/errand/${id}`}
      prefetch={false}
      className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  );
}

function ParticipantAvatars({ avatars }: { avatars: string[] }) {
  const visibleAvatars = avatars.slice(0, 3);
  if (visibleAvatars.length === 0) return null;

  return (
    <div className="flex -space-x-2" aria-hidden="true">
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={`${avatar}-${index}`}
          className="size-7 border-2 border-card"
        >
          <AvatarImage src={avatar} alt="" />
          <AvatarFallback>
            <RiUser3Line className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      ))}
      {avatars.length > 3 ? (
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
          +{avatars.length - 3}
        </span>
      ) : null}
    </div>
  );
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : `更新于 ${updatedAtFormatter.format(date)}`;
}
