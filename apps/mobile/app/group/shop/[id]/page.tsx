import {
  listProductTemplatesPage,
  listStores,
  type PageResult,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";
import { notFound } from "next/navigation";

import { ErrandShop } from "@/components/errand-shop";
import { mobileAppConfig } from "@/lib/app-config";
import { isValidRouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

type GroupShopPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type StoreDetail = {
  store: Store | null;
  templatePage: PageResult<ProductTemplate>;
};

async function loadStoreDetail(storeId: string): Promise<StoreDetail> {
  const options = await getServerServiceOptions();
  const [stores, templatePage] = await Promise.all([
    listStores(options),
    listProductTemplatesPage({
      ...options,
      storeId,
      page: 1,
      pageSize: 20,
    }),
  ]);

  return {
    store: stores.find((store) => store.id === storeId) ?? null,
    templatePage,
  };
}

export default async function GroupShopPage({ params }: GroupShopPageProps) {
  const { id } = await params;
  if (!isValidRouteId(id)) notFound();
  const { store, templatePage } = await loadStoreDetail(id);

  if (!store) notFound();

  return (
    <ErrandShop
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      store={store}
      initialPage={templatePage}
    />
  );
}
