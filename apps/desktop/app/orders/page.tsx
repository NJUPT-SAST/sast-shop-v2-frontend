import {
  listBuyerErrandOrdersPage,
  listErrandTasksPage,
  listSpotOrdersPage,
} from "@sast-shop/api";

import { OrdersView } from "@/components/orders-view";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerServiceOptions } from "@/lib/server-service-options";
import { getOrderFiltersFromParams } from "@/lib/order-filters";

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
  const options = await getServerServiceOptions();
  const results = await Promise.allSettled([
    listSpotOrdersPage({
      ...options,
      perspective: "purchaser",
      page: 1,
      pageSize: 24,
    }),
    listSpotOrdersPage({
      ...options,
      perspective: "seller",
      page: 1,
      pageSize: 24,
    }),
    listBuyerErrandOrdersPage({ ...options, page: 1, pageSize: 24 }),
    listErrandTasksPage({ ...options, page: 1, pageSize: 24 }),
  ]);

  return (
    <OrdersView
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      initialFilters={filters}
      spotBuyerPage={pageOrEmpty(results[0], 24)}
      spotSellerPage={pageOrEmpty(results[1], 24)}
      buyerErrandPage={pageOrEmpty(results[2], 24)}
      errandTaskPage={pageOrEmpty(results[3], 24)}
      errors={{
        spotBuyer: results[0].status === "rejected",
        spotSeller: results[1].status === "rejected",
        errandParticipant: results[2].status === "rejected",
        errandCaptain: results[3].status === "rejected",
      }}
    />
  );
}

function pageOrEmpty<T>(
  result: PromiseSettledResult<import("@sast-shop/api").PageResult<T>>,
  pageSize: number,
) {
  return result.status === "fulfilled"
    ? result.value
    : {
        items: [],
        currentPage: 1,
        pageSize,
        totalCount: 0,
        hasMore: false,
      };
}
