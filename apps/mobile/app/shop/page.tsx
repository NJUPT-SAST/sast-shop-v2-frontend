import { randomUUID } from "node:crypto";
import { listSpotGoods, type ListSpotGoodsResult } from "@sast-shop/api";
import { SpotMarketplace } from "@/components/spot-marketplace";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";

async function getSpotGoods() {
  try {
    const options = await getServerServiceOptions();
    return {
      page: await listSpotGoods({ ...options, page: 1, pageSize: 20 }),
      error: null,
    };
  } catch {
    return {
      page: {
        goods: [],
        currentPage: 0,
        totalCount: 0,
        pageSize: 20,
      } satisfies ListSpotGoodsResult,
      error: "现货商品暂不可用，请稍后再试",
    };
  }
}

export default async function ShopPage() {
  const result = await getSpotGoods();
  const refreshKey = randomUUID();

  return (
    <SpotMarketplace
      key={refreshKey}
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      initialPage={result.page}
      error={result.error}
    />
  );
}
