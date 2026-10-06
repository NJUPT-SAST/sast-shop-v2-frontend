import { randomUUID } from "node:crypto";
import { CachedOrdersView } from "@/components/cached-orders-view";
import { mobileAppConfig } from "@/lib/app-config";
import { getOrderFiltersFromParams } from "@/lib/order-filters";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await (searchParams ?? Promise.resolve({}));
  const initialFilters = getOrderFiltersFromParams(toURLSearchParams(params));
  return (
    <CachedOrdersView
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      initialFilters={initialFilters}
      refreshKey={randomUUID()}
    />
  );
}

function toURLSearchParams(
  params: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
      continue;
    }

    if (value !== undefined) {
      search.set(key, value);
    }
  }

  return search;
}
