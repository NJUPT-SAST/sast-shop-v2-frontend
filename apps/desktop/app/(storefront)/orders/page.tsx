import { randomUUID } from "node:crypto";
import { CachedOrdersView } from "@/components/cached-orders-view";
import { desktopAppConfig } from "@/lib/app-config";
import { getOrderFiltersFromParams } from "@/lib/order-filters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawParams = await searchParams;
  const filters = getOrderFiltersFromParams(
    new URLSearchParams(
      Object.entries(rawParams).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
  );
  return (
    <CachedOrdersView
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      initialFilters={filters}
      refreshKey={randomUUID()}
    />
  );
}
