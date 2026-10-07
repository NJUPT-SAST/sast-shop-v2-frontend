"use client";

import { useState } from "react";
import {
  listProductTemplatesPage,
  listStores,
  type DataSource,
  type ProductTemplate,
  type PageResult,
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
      "mobile:templates",
      dataSource,
      connectBaseUrl,
      requestedStoreId ?? "",
      rememberedStoreId ?? "",
    ]),
    staleTime: 300_000,
    refreshKey,
    load: async () => {
      const options = { dataSource, connectBaseUrl };
      const stores = await listStores(options);
      const selectedStoreId = resolveTemplateStoreId(
        {
          stores,
          requestedStoreId,
          fallbackStoreId: stores[0]?.id ?? null,
        },
        { getItem: () => rememberedStoreId },
      );
      const templatePage: PageResult<ProductTemplate> = selectedStoreId
        ? await listProductTemplatesPage({
            ...options,
            storeId: selectedStoreId,
            page: 1,
            pageSize: 20,
          })
        : {
            items: [],
            currentPage: 1,
            pageSize: 20,
            totalCount: 0,
            hasMore: false,
          };
      return { stores, selectedStoreId, templatePage };
    },
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
      <ProductTemplateManager
        key={[
          data.selectedStoreId ?? "none",
          startCreating,
          prefillBarcode,
        ].join(":")}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        stores={data.stores}
        initialPage={data.templatePage}
        selectedStoreId={data.selectedStoreId}
        requestedStoreId={requestedStoreId}
        requestedTemplateId={requestedTemplateId}
        prefillBarcode={prefillBarcode}
        startCreating={startCreating}
        error={null}
      />
      {error ? (
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
