import { ProfileManagementClient } from "./profile-management-client";

export function ProfileManagement({
  feedbackFormUrl,
}: {
  feedbackFormUrl: string | null;
}) {
  return <ProfileManagementClient feedbackFormUrl={feedbackFormUrl} />;
}
