import {
  getErrandDemandDetails,
  listStores,
  type ErrandDemandDetailGroup,
} from "@sast-shop/api";
import { notFound } from "next/navigation";

import { ErrandDemandDetail } from "@/components/errand-demand-detail";
import { desktopAppConfig } from "@/lib/app-config";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function ErrandDemandDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId: rawStoreId } = await params;
  const storeId = parsePositiveInt64RouteId(rawStoreId);
  if (!storeId) notFound();

  const options = await getServerServiceOptions();
  let details: ErrandDemandDetailGroup[] = [];
  let storeName = "店铺需求";
  let error: string | null = null;

  try {
    const [demandGroups, stores] = await Promise.all([
      getErrandDemandDetails({ storeId }, options),
      listStores(options).catch(() => []),
    ]);
    details = demandGroups;
    storeName = stores.find((store) => store.id === storeId)?.name ?? storeName;
  } catch {
    error = "跑腿需求详情暂不可用，请返回大厅后重试。";
  }

  return (
    <ErrandDemandDetail
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      storeId={storeId}
      storeName={storeName}
      details={details}
      error={error}
    />
  );
}
