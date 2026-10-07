"use client";

import {
  listAddresses,
  listPaymentQrCodes,
  type DataSource,
  type ProfileOverview,
} from "@sast-shop/api";
import { useCachedResource } from "@workspace/ui/hooks/use-cached-resource";
import { ProfileManagement } from "@/components/profile-management";
import { loadCurrentUser } from "@/lib/current-user";
import ProfileLoading from "@/components/profile-page-skeleton";

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
    load: () => loadCurrentUser(options, authRequired),
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
