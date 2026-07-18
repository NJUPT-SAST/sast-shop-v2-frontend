import {
  listProductTemplates,
  listStores,
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

  return (
    <ProductTemplateManager
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      stores={data.stores}
      initialTemplates={data.templates}
      selectedStoreId={data.selectedStoreId}
      prefillBarcode={firstValue(query.barcode) ?? ""}
      startCreating={firstValue(query.create) === "1"}
      error={data.error}
    />
  );
}

async function loadPageData(requestedStoreId: string | undefined): Promise<{
  stores: Store[];
  templates: ProductTemplate[];
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
    const templates = selectedStoreId
      ? await listProductTemplates({ ...options, storeId: selectedStoreId })
      : [];
    return { stores, templates, selectedStoreId, error: null };
  } catch {
    return {
      stores: [],
      templates: [],
      selectedStoreId: null,
      error: "请稍后重试",
    };
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
