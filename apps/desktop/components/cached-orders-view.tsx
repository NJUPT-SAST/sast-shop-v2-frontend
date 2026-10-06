"use client";

import {
  listBuyerErrandOrdersPage,
  listErrandTasksPage,
  listSpotOrdersPage,
  type DataSource,
  type PageResult,
} from "@sast-shop/api";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { OrdersView } from "@/components/orders-view";
import { OrdersPageSkeleton } from "@/components/orders-page-skeleton";
import type { OrderFilters } from "@/lib/order-filters";

const emptyPage = {
  items: [],
  currentPage: 1,
  pageSize: 24,
  totalCount: 0,
  hasMore: false,
} satisfies PageResult<never>;

export function CachedOrdersView({
  dataSource,
  connectBaseUrl,
  initialFilters,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  initialFilters: OrderFilters;
  refreshKey: string;
}) {
  const options = { dataSource, connectBaseUrl, page: 1, pageSize: 24 };
  const scope = JSON.stringify(["desktop", dataSource, connectBaseUrl]);
  const spotBuyer = useCachedResource({
    cacheKey: `orders:spot:buyer:${scope}`,
    load: () => listSpotOrdersPage({ ...options, perspective: "purchaser" }),
    staleTime: 15_000,
    refreshKey,
  });
  const spotSeller = useCachedResource({
    cacheKey: `orders:spot:seller:${scope}`,
    load: () => listSpotOrdersPage({ ...options, perspective: "seller" }),
    staleTime: 15_000,
    refreshKey,
  });
  const errandParticipant = useCachedResource({
    cacheKey: `orders:errand:participant:${scope}`,
    load: () => listBuyerErrandOrdersPage(options),
    staleTime: 15_000,
    refreshKey,
  });
  const errandCaptain = useCachedResource({
    cacheKey: `orders:errand:captain:${scope}`,
    load: () => listErrandTasksPage(options),
    staleTime: 15_000,
    refreshKey,
  });
  const resources = [spotBuyer, spotSeller, errandParticipant, errandCaptain];
  if (
    resources.every((resource) => !resource.data) &&
    resources.some((resource) => !resource.data && !resource.error)
  ) {
    return <OrdersPageSkeleton />;
  }
  const failedUpdates = [
    spotBuyer,
    spotSeller,
    errandParticipant,
    errandCaptain,
  ].filter((resource) => resource.data && resource.error);

  return (
    <>
      {failedUpdates.length > 0 ? (
        <LoadFailure
          variant="compact"
          title="部分订单更新失败"
          description="已保留上次加载的订单信息"
          onRetry={() => {
            void Promise.all(
              failedUpdates.map((resource) => resource.refresh()),
            );
          }}
        />
      ) : null}
      <OrdersView
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        initialFilters={initialFilters}
        spotBuyerPage={spotBuyer.data ?? emptyPage}
        spotSellerPage={spotSeller.data ?? emptyPage}
        buyerErrandPage={errandParticipant.data ?? emptyPage}
        errandTaskPage={errandCaptain.data ?? emptyPage}
        initialLoading={{
          spotBuyer: !spotBuyer.data && !spotBuyer.error,
          spotSeller: !spotSeller.data && !spotSeller.error,
          errandParticipant:
            !errandParticipant.data && !errandParticipant.error,
          errandCaptain: !errandCaptain.data && !errandCaptain.error,
        }}
        errors={{
          spotBuyer: Boolean(spotBuyer.error && !spotBuyer.data),
          spotSeller: Boolean(spotSeller.error && !spotSeller.data),
          errandParticipant: Boolean(
            errandParticipant.error && !errandParticipant.data,
          ),
          errandCaptain: Boolean(errandCaptain.error && !errandCaptain.data),
        }}
      />
    </>
  );
}
