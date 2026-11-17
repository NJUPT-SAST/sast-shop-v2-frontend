import { randomUUID } from "node:crypto";
import { GroupOverviewClient } from "@/components/group-overview-client";
import { desktopAppConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default function GroupPage() {
  return (
    <GroupOverviewClient
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
    />
  );
}
