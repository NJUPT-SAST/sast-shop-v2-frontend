import { getErrandDemandDetails, listStores } from "@sast-shop/api";
import { notFound } from "next/navigation";

import { ErrandDemandDetail } from "@/components/errand-demand-detail";
import { mobileAppConfig } from "@/lib/app-config";
import { isValidRouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

type ErrandDemandDetailPageProps = {
  params: Promise<{
    storeId: string;
  }>;
};

export default async function ErrandDemandDetailPage({
  params,
}: ErrandDemandDetailPageProps) {
  const { storeId } = await params;
  if (!isValidRouteId(storeId)) notFound();

  const options = await getServerServiceOptions();
  const [details, stores] = await Promise.all([
    getErrandDemandDetails({ storeId }, options),
    listStores(options),
  ]);
  const store = stores.find((candidate) => candidate.id === storeId);
  if (!store) notFound();

  return (
    <ErrandDemandDetail
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      storeId={storeId}
      storeName={store.name}
      details={details}
    />
  );
}
