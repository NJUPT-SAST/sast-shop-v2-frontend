import { listProductTemplatesPage, listStores } from "@sast-shop/api";
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

export default async function GroupShopPage({ params }: GroupShopPageProps) {
  const { id } = await params;
  if (!isValidRouteId(id)) notFound();
  const options = await getServerServiceOptions();
  const stores = await listStores(options);
  const store = stores.find((candidate) => candidate.id === id);
  if (!store) notFound();
  const templatePage = await listProductTemplatesPage({
    ...options,
    storeId: id,
    page: 1,
    pageSize: 20,
  });

  return (
    <ErrandShop
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      store={store}
      initialPage={templatePage}
    />
  );
}
