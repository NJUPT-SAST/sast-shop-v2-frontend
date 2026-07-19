import { listErrandDemandStoresPage, type PageResult } from "@sast-shop/api";
import { ErrandDemandHall } from "@/components/errand-demand-hall";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";

async function loadErrandDemandStores(): Promise<{
  page: PageResult<import("@sast-shop/api").ErrandDemandStoreSummary>;
  error: string | null;
}> {
  try {
    return {
      page: await listErrandDemandStoresPage({
        ...(await getServerServiceOptions()),
        page: 1,
        pageSize: 20,
      }),
      error: null,
    };
  } catch {
    return {
      page: {
        items: [],
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        hasMore: false,
      },
      error: "跑腿需求暂不可用，请稍后再试",
    };
  }
}

export default async function ErrandDemandHallPage() {
  const result = await loadErrandDemandStores();

  return (
    <ErrandDemandHall
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      initialPage={result.page}
      error={result.error}
    />
  );
}
