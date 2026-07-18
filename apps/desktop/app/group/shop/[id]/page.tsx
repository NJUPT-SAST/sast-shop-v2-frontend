import {
  listProductTemplates,
  listStores,
  type ProductTemplate,
  type Store,
} from "@sast-shop/api"
import { notFound } from "next/navigation"

import { ErrandShop } from "@/components/errand-shop"
import { desktopAppConfig } from "@/lib/app-config"
import { parsePositiveInt64RouteId } from "@/lib/route-id"
import { getServerServiceOptions } from "@/lib/server-service-options"

export default async function GroupShopPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const id = parsePositiveInt64RouteId(rawId)
  if (!id) notFound()

  const options = await getServerServiceOptions()
  let store: Store | null = null
  let templates: ProductTemplate[] = []
  let error: string | null = null

  try {
    const [stores, productTemplates] = await Promise.all([
      listStores(options),
      listProductTemplates({ ...options, storeId: id }),
    ])
    store = stores.find((item) => item.id === id) ?? null
    templates = productTemplates
  } catch {
    error = "店铺商品暂不可用，请稍后再试。"
  }

  if (!store && !error) notFound()

  return (
    <ErrandShop
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
      store={store}
      templates={templates}
      error={error}
    />
  )
}
