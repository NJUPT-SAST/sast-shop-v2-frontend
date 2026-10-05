import { randomUUID } from "node:crypto";
import { CachedErrandLobby } from "@/components/cached-errand-lobby";
import { mobileAppConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default function ErrandDemandHallPage() {
  return (
    <CachedErrandLobby
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
    />
  );
}
