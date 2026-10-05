import { randomUUID } from "node:crypto";
import { ProfilePageClient } from "@/components/profile-page-client";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <ProfilePageClient
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      feedbackFormUrl={mobileAppConfig.feedbackFormUrl}
      authRequired={getServerAuthMode() === "required"}
      refreshKey={randomUUID()}
    />
  );
}
