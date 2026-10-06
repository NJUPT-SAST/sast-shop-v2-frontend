"use client";

import { listErrandDemandStoresPage, type DataSource } from "@sast-shop/api";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";

import ErrandDemandHallLoading from "@/components/errand-lobby-skeleton";
import { ErrandDemandHall } from "@/components/errand-demand-hall";

const emptyPage = {
  items: [],
  currentPage: 1,
  pageSize: 24,
  totalCount: 0,
  hasMore: false,
};
const failureMessage = "跑腿需求暂不可用，请稍后再试。";

export function CachedErrandLobby({
  dataSource,
  connectBaseUrl,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  refreshKey: string;
}) {
  const { data, error, refresh } = useCachedResource({
    cacheKey: `desktop:errand-lobby:${dataSource}:${connectBaseUrl}`,
    load: () =>
      listErrandDemandStoresPage({
        dataSource,
        connectBaseUrl,
        page: 1,
        pageSize: emptyPage.pageSize,
      }),
    staleTime: 30_000,
    refreshKey,
  });

  if (!data && !error) return <ErrandDemandHallLoading />;

  return (
    <>
      <ErrandDemandHall
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        initialPage={data ?? emptyPage}
        error={!data && error ? failureMessage : null}
      />
      {data && error ? (
        <LoadFailure
          title="跑腿需求更新失败"
          description="当前显示上次加载的需求，请重试更新"
          onRetry={() => void refresh()}
        />
      ) : null}
    </>
  );
}
