import {
  listProductTemplates,
  listStores,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";
import { ProductTemplateManager } from "@/components/product-template-manager";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";

type ProductTemplatesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TemplatePageData = {
  stores: Store[];
  templates: ProductTemplate[];
  selectedStoreId: string | null;
  error: string | null;
};

export default async function ProductTemplatesPage({
  searchParams,
}: ProductTemplatesPageProps) {
  const query: Record<string, string | string[] | undefined> =
    await (searchParams ?? Promise.resolve({}));
  const data = await loadTemplatePageData(firstValue(query.store));

  return (
    <ProductTemplateManager
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      stores={data.stores}
      initialTemplates={data.templates}
      selectedStoreId={data.selectedStoreId}
      prefillBarcode={firstValue(query.barcode) ?? ""}
      startCreating={firstValue(query.create) === "1"}
      error={data.error}
    />
  );
}

async function loadTemplatePageData(
  requestedStoreId: string | undefined,
): Promise<TemplatePageData> {
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
      error: "商品模板暂不可用，请稍后再试",
    };
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
