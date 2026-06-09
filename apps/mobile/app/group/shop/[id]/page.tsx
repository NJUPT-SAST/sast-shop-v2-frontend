import {
  listProductTemplates,
  listStores,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api"
import { RiStore2Line } from "@remixicon/react"
import { Empty } from "@workspace/ui/components/empty"

import { ErrandShop } from "@/components/errand-shop"
import { mobileAppConfig } from "@/lib/app-config"

type GroupShopPageProps = {
  params: Promise<{
    id: string
  }>
}

type StoreDetail = {
  store: Store | null
  templates: ProductTemplate[]
  error: string | null
}

async function loadStoreDetail(storeId: string): Promise<StoreDetail> {
  try {
    const [stores, templates] = await Promise.all([
      listStores({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
      }),
      listProductTemplates({
        dataSource: mobileAppConfig.dataSource,
        connectBaseUrl: mobileAppConfig.connectBaseUrl,
        storeId,
      }),
    ])

    return {
      store: stores.find((store) => store.id === storeId) ?? null,
      templates,
      error: null,
    }
  } catch {
    return {
      store: null,
      templates: [],
      error: "店铺商品暂不可用，请稍后再试",
    }
  }
}

export default async function GroupShopPage({ params }: GroupShopPageProps) {
  const { id } = await params
  const { store, templates, error } = await loadStoreDetail(id)

  if (error || !store) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="店铺暂不可用"
          description={error ?? "没有找到对应店铺。"}
        />
      </div>
    )
  }

  return (
    <ErrandShop
      dataSource={mobileAppConfig.dataSource}
      connectBaseUrl={mobileAppConfig.connectBaseUrl}
      store={store}
      templates={templates}
    />
  )
}
