import { createClient } from "@connectrpc/connect"
import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb"
import { ProductTemplateService } from "../gen/sast/sastshopv2/catalog/v1/product_template_service_pb"
import { resolveDataSource, type ServiceOptions } from "../data-source"
import { FeatureUnavailableError, ValidationError } from "../errors"
import { createLocalTransport, requestLocal } from "../local-connect"
import { listStores } from "./catalog"

export interface ProductTemplate {
  id: string
  title: string
  description: string
  priceCents: number
  storeId: string
  mainImageUrl: string
  barcode: string
  updatedAt: string | null
}

export async function listProductTemplates(
  options: ServiceOptions & { storeId?: string; page?: number; pageSize?: number } = {}
): Promise<ProductTemplate[]> {
  const dataSource = resolveDataSource(options)

  if (dataSource === "mock" || dataSource === "local") {
    if (options.storeId) {
      return listTemplatesByStore(options.storeId, options)
    }

    const stores = await listStores(options)
    const templates = await Promise.all(
      stores.map((store) => listTemplatesByStore(store.id, options))
    )

    return templates.flat()
  }

  throw new FeatureUnavailableError("listProductTemplates")
}

async function listTemplatesByStore(
  storeId: string,
  options: ServiceOptions & { page?: number; pageSize?: number }
): Promise<ProductTemplate[]> {
  const client = createClient(ProductTemplateService, createLocalTransport(options))
  const response = await requestLocal("listProductTemplates", () =>
    client.getProductTemplateList({
      storeId: parseInt64(storeId, "店铺 ID 不正确"),
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 50,
    })
  )

  return response.productTemplates.map(mapTemplate)
}

function mapTemplate(template?: ProtoProductTemplate): ProductTemplate {
  return {
    id: template?.id.toString() ?? "0",
    title: template?.title ?? "未命名商品",
    description: template?.description ?? "",
    priceCents: template?.priceCents ?? 0,
    storeId: template?.storeId.toString() ?? "0",
    mainImageUrl: template?.mainImageUrl ?? "",
    barcode: template?.barcode ?? "",
    updatedAt: template?.updatedAt
      ? new Date(Number(template.updatedAt.seconds) * 1000).toISOString()
      : null,
  }
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ValidationError(message)
  }

  return BigInt(value)
}
