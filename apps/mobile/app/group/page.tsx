import { randomUUID } from "node:crypto";
import { GroupOverviewClient } from "@/components/group-overview-client";
import { mobileAppConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default function GroupPage() {
  return (
    <GroupOverviewClient
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      refreshKey={randomUUID()}
    />
  );
}
