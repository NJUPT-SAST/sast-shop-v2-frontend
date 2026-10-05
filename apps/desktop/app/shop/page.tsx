import { randomUUID } from "node:crypto";
import { CachedSpotMarketplace } from "@/components/cached-spot-marketplace";
import { desktopAppConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  return (
    <CachedSpotMarketplace
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
    />
  );
}
