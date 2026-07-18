import {
  getCurrentUser,
  getSpotOrderDetail,
  ResourceNotFoundError,
} from "@sast-shop/api";
import { notFound } from "next/navigation";

import { SpotOrderDetail } from "@/components/spot-order-detail";
import { desktopAppConfig } from "@/lib/app-config";
import { sanitizeDesktopReturnTo } from "@/lib/navigation";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";
import type { SpotOrderView } from "@/lib/spot-orders";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; returnTo?: string }>;
};

export default async function SpotOrderDetailPage({
  params,
  searchParams,
}: Props) {
  const id = parsePositiveInt64RouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const returnTo = sanitizeDesktopReturnTo(query.returnTo);
  const options = await getServerServiceOptions();
  const [order, currentUser] = await loadOrderAndUser(id, options);
  const actorView: SpotOrderView | null = currentUser
    ? currentUser.id === order.bill?.payee?.id ||
      currentUser.id === order.seller?.id
      ? "seller"
      : currentUser.id === order.bill?.payer?.id
        ? "buyer"
        : null
    : null;
  if (!actorView) notFound();
  return (
    <SpotOrderDetail
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      order={order}
      view={actorView}
      returnTo={returnTo}
    />
  );
}

async function loadOrderAndUser(
  id: string,
  options: Awaited<ReturnType<typeof getServerServiceOptions>>,
) {
  try {
    return await Promise.all([
      getSpotOrderDetail(id, options),
      getCurrentUser(options).catch(() => null),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
}
