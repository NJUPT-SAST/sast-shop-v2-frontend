import { randomUUID } from "node:crypto";
import { listSpotGoods, type ListSpotGoodsResult } from "@sast-shop/api";

import { SpotMarketplace } from "@/components/spot-marketplace";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function ShopPage() {
  const options = await getServerServiceOptions();
  let page: ListSpotGoodsResult = {
    goods: [],
    currentPage: 0,
    totalCount: 0,
    pageSize: 24,
  };
  let errorMessage: string | null = null;
  try {
    page = await listSpotGoods({ ...options, page: 1, pageSize: 24 });
  } catch {
    errorMessage = "现货商品暂不可用，请稍后再试";
  }
  const refreshKey = randomUUID();
  return (
    <SpotMarketplace
      key={refreshKey}
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      initialPage={page}
      error={errorMessage}
    />
  );
}
