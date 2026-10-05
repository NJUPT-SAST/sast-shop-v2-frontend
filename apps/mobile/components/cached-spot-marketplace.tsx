"use client";

import { listSpotGoods, type DataSource } from "@sast-shop/api";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SpotMarketplace } from "./spot-marketplace";

export function CachedSpotMarketplace({
  dataSource,
  connectBaseUrl,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  refreshKey: string;
}) {
  const { data, error, refresh } = useCachedResource({
    cacheKey: JSON.stringify(["mobile:shop", dataSource, connectBaseUrl]),
    staleTime: 60_000,
    refreshKey,
    load: () =>
      listSpotGoods({ dataSource, connectBaseUrl, page: 1, pageSize: 20 }),
  });
  if (!data) {
    if (error)
      return (
        <LoadFailure
          title="商品加载失败"
          description="现货商品暂不可用，请稍后再试"
          onRetry={() => void refresh()}
        />
      );
    return (
      <div
        className="grid grid-cols-2 gap-3 py-6"
        role="status"
        aria-label="正在加载商品"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }
  return (
    <>
      <SpotMarketplace
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        initialPage={data}
        error={null}
      />
      {error ? (
        <LoadFailure
          variant="compact"
          title="商品更新失败"
          description="正在显示上次加载的商品"
          onRetry={() => void refresh()}
        />
      ) : null}
    </>
  );
}
