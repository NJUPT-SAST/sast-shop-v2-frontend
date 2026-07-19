import {
  listProductTemplatesPage,
  listStores,
  type PageResult,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";

import { ProductTemplateManager } from "@/components/product-template-manager";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";

type ProductTemplatesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductTemplatesPage({
  searchParams,
}: ProductTemplatesPageProps) {
  const query: Record<string, string | string[] | undefined> =
    await (searchParams ?? Promise.resolve({}));
  const data = await loadPageData(firstValue(query.store));
  const prefillBarcode = firstValue(query.barcode) ?? "";
  const startCreating = firstValue(query.create) === "1";

  return (
    <ProductTemplateManager
      key={`${data.selectedStoreId ?? "none"}:${startCreating}:${prefillBarcode}`}
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      stores={data.stores}
      initialPage={data.templatePage}
      selectedStoreId={data.selectedStoreId}
      prefillBarcode={prefillBarcode}
      startCreating={startCreating}
      error={data.error}
    />
  );
}

async function loadPageData(requestedStoreId: string | undefined): Promise<{
  stores: Store[];
  templatePage: PageResult<ProductTemplate>;
  selectedStoreId: string | null;
  error: string | null;
}> {
  try {
    const options = await getServerServiceOptions();
    const stores = await listStores(options);
    const selectedStoreId = stores.some(
      (store) => store.id === requestedStoreId,
    )
      ? requestedStoreId!
      : (stores[0]?.id ?? null);
    const templatePage = selectedStoreId
      ? await listProductTemplatesPage({
          ...options,
          storeId: selectedStoreId,
          page: 1,
          pageSize: 24,
        })
      : emptyTemplatePage(24);
    return { stores, templatePage, selectedStoreId, error: null };
  } catch {
    return {
      stores: [],
      templatePage: emptyTemplatePage(24),
      selectedStoreId: null,
      error: "请稍后重试",
    };
  }
}

function emptyTemplatePage(pageSize: number): PageResult<ProductTemplate> {
  return {
    items: [],
    currentPage: 1,
    pageSize,
    totalCount: 0,
    hasMore: false,
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
