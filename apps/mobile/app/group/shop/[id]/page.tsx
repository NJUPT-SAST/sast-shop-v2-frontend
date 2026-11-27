import {
  listProductCategories,
  listProductTemplatesPage,
  listStores,
} from "@sast-shop/api";
import { getDefaultProductCategoryId } from "@sast-shop/domain";
import { notFound } from "next/navigation";

import { ErrandShop } from "@/components/errand-shop";
import { mobileAppConfig } from "@/lib/app-config";
import { isValidRouteId } from "@/lib/route-id";
import { getServerServiceOptions } from "@/lib/server-service-options";

type GroupShopPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GroupShopPage({ params }: GroupShopPageProps) {
  const { id } = await params;
  if (!isValidRouteId(id)) notFound();
  const options = await getServerServiceOptions();
  const stores = await listStores(options);
  const store = stores.find((candidate) => candidate.id === id);
  if (!store) notFound();
  const categoryList = await listProductCategories(id, options);
  const initialCategoryId = getDefaultProductCategoryId(
    categoryList.categories,
  );
  const pageSize = 20;
  const templatePage =
    initialCategoryId || categoryList.hasUncategorizedProducts
      ? await listProductTemplatesPage({
          ...options,
          storeId: id,
          page: 1,
          pageSize,
          ...(initialCategoryId
            ? { categoryFilterMode: "category", categoryId: initialCategoryId }
            : { categoryFilterMode: "uncategorized" }),
        })
      : { items: [], currentPage: 1, pageSize, totalCount: 0, hasMore: false };

  return (
    <ErrandShop
      key={id}
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      store={store}
      initialPage={templatePage}
      categories={categoryList.categories}
      initialCategoryId={initialCategoryId}
      hasUncategorizedProducts={categoryList.hasUncategorizedProducts}
    />
  );
}
