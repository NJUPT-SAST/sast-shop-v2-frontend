import { listErrandDemandStoresPage, type PageResult } from "@sast-shop/api";

import { ErrandDemandHall } from "@/components/errand-demand-hall";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function ErrandDemandHallPage() {
  let page: PageResult<import("@sast-shop/api").ErrandDemandStoreSummary> = {
    items: [],
    currentPage: 1,
    pageSize: 24,
    totalCount: 0,
    hasMore: false,
  };
  let error: string | null = null;

  try {
    page = await listErrandDemandStoresPage({
      ...(await getServerServiceOptions()),
      page: 1,
      pageSize: 24,
    });
  } catch {
    error = "跑腿需求暂不可用，请稍后再试。";
  }

  return (
    <ErrandDemandHall
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      initialPage={page}
      error={error}
    />
  );
}
