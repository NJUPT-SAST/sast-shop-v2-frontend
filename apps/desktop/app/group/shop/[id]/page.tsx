import {
  getBuyerErrandOrderDetail,
  listProductTemplatesPage,
  listStores,
  type BuyerErrandOrderProductItem,
  type PageResult,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";
import { notFound, redirect } from "next/navigation";

import { ErrandShop } from "@/components/errand-shop";
import { desktopAppConfig } from "@/lib/app-config";
import { parsePositiveInt64RouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

export default async function GroupShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: rawId } = await params;
  const id = parsePositiveInt64RouteId(rawId);
  if (!id) notFound();
  const rawSearchParams = await searchParams;
  const editDemandId =
    typeof rawSearchParams.editDemandId === "string"
      ? parsePositiveInt64RouteId(rawSearchParams.editDemandId)
      : null;

  const options = await getServerServiceOptions();
  let store: Store | null = null;
  let templatePage: PageResult<ProductTemplate> = emptyTemplatePage(24);
  let error: string | null = null;
  let editUpdatedAt: string | null = null;
  let editInitialItems: EditItem[] | null = null;
  let editDeadline: string | null = null;

  try {
    const [stores, productTemplates] = await Promise.all([
      listStores(options),
      listProductTemplatesPage({
        ...options,
        storeId: id,
        page: 1,
        pageSize: 24,
      }),
    ]);
    store = stores.find((item) => item.id === id) ?? null;
    templatePage = productTemplates;
  } catch {
    error = "店铺商品暂不可用，请稍后再试。";
  }

  if (editDemandId != null) {
    try {
      const detail = await getBuyerErrandOrderDetail(editDemandId, options);
      if (detail.status !== "open") {
        redirect("/orders?type=errand&view=participant");
      }
      editUpdatedAt = detail.updatedAt;
      editInitialItems = detail.productItems.map(mapEditItem);
      editDeadline = detail.deadline;
    } catch {
      // 详情不可用时仍可进入，提交时后端会做 open 状态与并发校验。
    }
  }

  if (!store && !error) notFound();

  return (
    <ErrandShop
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      store={store}
      initialPage={templatePage}
      error={error}
      editDemandId={editDemandId}
      editUpdatedAt={editUpdatedAt}
      editInitialItems={editInitialItems}
      editDeadline={editDeadline}
    />
  );
}

type EditItem = {
  template: ProductTemplate;
  quantity: number;
  serviceFeePerUnitCents: number;
};

function mapEditItem(item: BuyerErrandOrderProductItem): EditItem {
  return {
    template: item.productTemplate,
    quantity: item.requiredQuantity,
    serviceFeePerUnitCents: item.serviceFeePerUnitCents,
  };
}

function emptyTemplatePage(pageSize: number): PageResult<ProductTemplate> {
  return {
    items: [],
    currentPage: 1,
    pageSize,
    totalCount: 0,
    hasMore: false,
  };
}
