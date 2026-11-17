import { randomUUID } from "node:crypto";
import { ProfilePageClient } from "@/components/profile-page-client";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <ProfilePageClient
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      feedbackFormUrl={desktopAppConfig.feedbackFormUrl}
      authRequired={getServerAuthMode() === "required"}
      refreshKey={randomUUID()}
    />
  );
}
