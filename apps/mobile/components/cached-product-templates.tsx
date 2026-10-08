"use client";

import { useState } from "react";
import {
  listProductTemplatesPage,
  listStores,
  type DataSource,
  type ProductTemplate,
  type PageResult,
  type Store,
} from "@sast-shop/api";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { LoadFailure } from "@/components/load-failure";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ProductTemplateManager } from "./product-template-manager";
import {
  readTemplateStoreId,
  resolveTemplateStoreId,
} from "@/lib/template-store-preference";

export function CachedProductTemplates({
  dataSource,
  connectBaseUrl,
  refreshKey,
  requestedStoreId,
  requestedTemplateId,
  prefillBarcode,
  startCreating,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  refreshKey: string;
  requestedStoreId?: string;
  requestedTemplateId?: string;
  prefillBarcode: string;
  startCreating: boolean;
}) {
  const [rememberedStoreId] = useState(readTemplateStoreId);
  const { data, error, refresh } = useCachedResource({
    cacheKey: JSON.stringify([
      "mobile:templates:stores",
      dataSource,
      connectBaseUrl,
    ]),
    staleTime: 300_000,
    load: () => listStores({ dataSource, connectBaseUrl }),
  });
  if (!data) {
    if (error)
      return (
        <LoadFailure
          variant="page"
          title="商品模板加载失败"
          description="商品模板暂不可用，请稍后再试"
          onRetry={() => void refresh()}
        />
      );
    return (
      <div
        className="space-y-3 py-6"
        role="status"
        aria-label="正在加载商品模板"
      >
        <Skeleton className="h-12" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  return (
    <>
      <CachedTemplateList
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        refreshKey={refreshKey}
        stores={data}
        selectedStoreId={resolveTemplateStoreId(
          {
            stores: data,
            requestedStoreId,
            fallbackStoreId: data[0]?.id ?? null,
          },
          { getItem: () => rememberedStoreId },
        )}
        requestedStoreId={requestedStoreId}
        requestedTemplateId={requestedTemplateId}
        prefillBarcode={prefillBarcode}
        startCreating={startCreating}
      />
      {error ? (
        <LoadFailure
          variant="compact"
          title="店铺更新失败"
          description="正在显示上次加载的店铺"
          onRetry={() => void refresh()}
        />
      ) : null}
    </>
  );
}

const emptyTemplatePage: PageResult<ProductTemplate> = {
  items: [],
  currentPage: 1,
  pageSize: 20,
  totalCount: 0,
  hasMore: false,
};

function CachedTemplateList({
  dataSource,
  connectBaseUrl,
  refreshKey,
  stores,
  selectedStoreId,
  requestedStoreId,
  requestedTemplateId,
  prefillBarcode,
  startCreating,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  refreshKey: string;
  stores: Store[];
  selectedStoreId: string | null;
  requestedStoreId?: string;
  requestedTemplateId?: string;
  prefillBarcode: string;
  startCreating: boolean;
}) {
  const { data, error, refresh } = useCachedResource({
    cacheKey: JSON.stringify([
      "mobile:templates:list",
      dataSource,
      connectBaseUrl,
      selectedStoreId,
    ]),
    staleTime: 300_000,
    refreshKey,
    load: () =>
      selectedStoreId
        ? listProductTemplatesPage({
            dataSource,
            connectBaseUrl,
            storeId: selectedStoreId,
            page: 1,
            pageSize: emptyTemplatePage.pageSize,
          })
        : Promise.resolve(emptyTemplatePage),
  });

  return (
    <>
      <ProductTemplateManager
        key={[
          startCreating,
          prefillBarcode,
          startCreating ? selectedStoreId : "list",
        ].join(":")}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        stores={stores}
        initialPage={data ?? emptyTemplatePage}
        selectedStoreId={selectedStoreId}
        requestedStoreId={requestedStoreId}
        requestedTemplateId={requestedTemplateId}
        prefillBarcode={prefillBarcode}
        startCreating={startCreating}
        templatesLoading={Boolean(selectedStoreId && !data && !error)}
        error={error && !data ? "商品模板暂不可用，请稍后再试" : null}
        onRetry={() => void refresh()}
      />
      {error && data ? (
        <LoadFailure
          variant="compact"
          title="模板更新失败"
          description="正在显示上次加载的商品模板"
          onRetry={() => void refresh()}
        />
      ) : null}
    </>
  );
}
