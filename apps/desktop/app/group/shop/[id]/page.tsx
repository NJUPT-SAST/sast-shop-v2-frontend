import {
  listProductTemplatesPage,
  listStores,
  type PageResult,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";
import { notFound } from "next/navigation";

import { ErrandShop } from "@/components/errand-shop";
import { desktopAppConfig } from "@/lib/app-config";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function GroupShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: rawId } = await params;
  const rawSearchParams = await searchParams;
  const id = parsePositiveInt64RouteId(rawId);
  if (!id) notFound();
  const editDemandId =
    typeof rawSearchParams.editDemandId === "string"
      ? parsePositiveInt64RouteId(rawSearchParams.editDemandId)
      : null;

  const options = await getServerServiceOptions();
  let store: Store | null = null;
  let templatePage: PageResult<ProductTemplate> = emptyTemplatePage(24);
  let error: string | null = null;

  try {
    const [stores, productTemplates] = await Promise.all([
      listStores(options),
      listProductTemplatesPage({
        ...options,
        storeId: id,
        page: 1,
        pageSize: 24,
      }),
    ]);
    store = stores.find((item) => item.id === id) ?? null;
    templatePage = productTemplates;
  } catch {
    error = "店铺商品暂不可用，请稍后再试。";
  }

  if (!store && !error) notFound();

  return (
    <ErrandShop
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      store={store}
      initialPage={templatePage}
      error={error}
      prefillDemandId={editDemandId}
    />
  );
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
