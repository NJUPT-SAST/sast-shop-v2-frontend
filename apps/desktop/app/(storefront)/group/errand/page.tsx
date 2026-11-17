import { randomUUID } from "node:crypto";

import { CachedErrandLobby } from "@/components/cached-errand-lobby";
import { desktopAppConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default function ErrandDemandHallPage() {
  return (
    <CachedErrandLobby
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
    />
  );
}
