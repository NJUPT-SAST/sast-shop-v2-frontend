import { randomUUID } from "node:crypto";
import { CachedSpotMarketplace } from "@/components/cached-spot-marketplace";
import { mobileAppConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  return (
    <CachedSpotMarketplace
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
    />
  );
}
