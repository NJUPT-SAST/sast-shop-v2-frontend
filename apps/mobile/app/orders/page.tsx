import {
  listBuyerErrandOrdersPage,
  listErrandTasksPage,
  listSpotOrdersPage,
} from "@sast-shop/api";
import { OrdersView } from "@/components/orders-view";
import { mobileAppConfig } from "@/lib/app-config";
import { getOrderFiltersFromParams } from "@/lib/order-filters";
import { getServerServiceOptions } from "@/lib/server-service-options";

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getOrders() {
  const options = await getServerServiceOptions();
  const [
    spotBuyerResult,
    spotSellerResult,
    buyerErrandResult,
    errandTaskResult,
  ] = await Promise.allSettled([
    listSpotOrdersPage({
      ...options,
      perspective: "purchaser",
      page: 1,
      pageSize: 20,
    }),
    listSpotOrdersPage({
      ...options,
      perspective: "seller",
      page: 1,
      pageSize: 20,
    }),
    listBuyerErrandOrdersPage({ ...options, page: 1, pageSize: 20 }),
    listErrandTasksPage({ ...options, page: 1, pageSize: 20 }),
  ]);

  return {
    spotBuyerPage: pageOrEmpty(spotBuyerResult, 20),
    spotSellerPage: pageOrEmpty(spotSellerResult, 20),
    buyerErrandPage: pageOrEmpty(buyerErrandResult, 20),
    errandTaskPage: pageOrEmpty(errandTaskResult, 20),
    errors: {
      spotBuyer: spotBuyerResult.status === "rejected",
      spotSeller: spotSellerResult.status === "rejected",
      errandParticipant: buyerErrandResult.status === "rejected",
      errandCaptain: errandTaskResult.status === "rejected",
    },
  };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const [result, params] = await Promise.all([
    getOrders(),
    searchParams ?? Promise.resolve({}),
  ]);
  const initialFilters = getOrderFiltersFromParams(toURLSearchParams(params));

  return (
    <OrdersView
      {...result}
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      initialFilters={initialFilters}
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
