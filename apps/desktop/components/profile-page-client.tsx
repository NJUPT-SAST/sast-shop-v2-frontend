"use client";

import {
  AuthRequiredError,
  getCurrentUser,
  listAddresses,
  listPaymentQrCodes,
  type CurrentUser,
  type DataSource,
  type ProfileOverview,
  type ServiceOptions,
} from "@sast-shop/api";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { ProfileManagement } from "@/components/profile-management";
import ProfileLoading from "@/app/profile/loading";

async function loadProfileUser(
  options: ServiceOptions,
  authRequired: boolean,
): Promise<CurrentUser> {
  if (!authRequired) return getCurrentUser(options);
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error("个人资料暂不可用，请稍后再试");
  const session: unknown = await response.json();
  if (
    !session ||
    typeof session !== "object" ||
    !("authenticated" in session) ||
    session.authenticated !== true ||
    !("user" in session)
  ) {
    window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
    throw new AuthRequiredError();
  }
  const user = session.user;
  if (
    !user ||
    typeof user !== "object" ||
    !("id" in user) ||
    typeof user.id !== "string" ||
    !user.id ||
    !("name" in user) ||
    typeof user.name !== "string" ||
    !("avatarUrl" in user) ||
    typeof user.avatarUrl !== "string"
  ) {
    window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
    throw new AuthRequiredError();
  }
  return { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
}

export function ProfilePageClient({
  dataSource,
  connectBaseUrl,
  feedbackFormUrl,
  authRequired,
  refreshKey,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  feedbackFormUrl: string | null;
  authRequired: boolean;
  refreshKey: string;
}) {
  const options = { dataSource, connectBaseUrl };
  const cacheScope = JSON.stringify([dataSource, connectBaseUrl, authRequired]);
  const userResource = useCachedResource({
    cacheKey: `profile:user:${cacheScope}`,
    load: () => loadProfileUser(options, authRequired),
    staleTime: Infinity,
    invalidateOnWrite: false,
    refreshKey,
  });
  const addressesResource = useCachedResource({
    cacheKey: `profile:addresses:${cacheScope}`,
    load: () => listAddresses(options),
    staleTime: 300_000,
    refreshKey,
  });
  const qrResource = useCachedResource({
    cacheKey: `profile:qr:${cacheScope}`,
    load: () => listPaymentQrCodes(options),
    staleTime: 300_000,
    refreshKey,
  });
  if (
    (!userResource.data && userResource.loading) ||
    (!addressesResource.data && addressesResource.loading) ||
    (!qrResource.data && qrResource.loading)
  ) {
    return <ProfileLoading />;
  }
  const addresses = addressesResource.data ?? [];
  const overview: ProfileOverview | null = userResource.data
    ? {
        user: userResource.data,
        addresses,
        defaultAddress: addresses.find((address) => address.isDefault) ?? null,
        paymentQrCodes: qrResource.data ?? [],
      }
    : null;
  return (
    <ProfileManagement
      key={userResource.data?.id ?? "anonymous"}
      initialOverview={overview}
      error={userResource.error ? "个人资料暂不可用，请稍后再试" : null}
      initialAddressError={
        addressesResource.error ? "地址簿加载失败，请重试" : null
      }
      initialQrError={qrResource.error ? "收款码加载失败，请重试" : null}
      dataSource={dataSource}
      connectBaseUrl={connectBaseUrl}
      feedbackFormUrl={feedbackFormUrl}
    />
  );
}
