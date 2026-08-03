import { randomUUID } from "node:crypto";

import { SpotMarketplace } from "@/components/spot-marketplace";
import { desktopAppConfig } from "@/lib/app-config";
import { loadShopSpotGoodsPage } from "@/lib/shop-page-data";
import { getServerServiceOptions } from "@/lib/server-service-options";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const result = await loadShopSpotGoodsPage(await getServerServiceOptions());
  const refreshKey = randomUUID();
  return (
    <SpotMarketplace
      key={refreshKey}
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      initialPage={result.page}
      error={result.error}
    />
  );
}
