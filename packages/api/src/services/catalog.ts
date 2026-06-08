import { createClient } from "@connectrpc/connect"
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb"
import { CatalogService } from "../gen/sast/sastshopv2/catalog/v1/store_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"

export interface Store {
  id: string
  name: string
  address: string
  logoUrl: string
  themeColor: string
}

export async function listStores(
  options: ServiceOptions = {}
): Promise<Store[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(CatalogService, createLocalTransport(options))
    const response = await requestLocal("listStores", () =>
      client.getStoreList({})
    )

    return response.stores.map(mapStore)
  }

  throw new FeatureUnavailableError("listStores")
}

function mapStore(store: ProtoStore): Store {
  return {
    id: store.id.toString(),
    name: store.name,
    address: store.address,
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
  }
}
