import { createClient } from "@connectrpc/connect";

import type { ProductCategory as ProtoProductCategory } from "../gen/sast/sastshopv2/catalog/v1/product_category_pb";
import { ProductTemplateService } from "../gen/sast/sastshopv2/catalog/v1/product_template_service_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";

const MAX_SIGNED_INT64 = 9223372036854775807n;
const MAX_CATEGORY_NAME_LENGTH = 50;

export interface ProductCategory {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
}

export interface ProductCategoryList {
  categories: ProductCategory[];
  hasUncategorizedProducts: boolean;
}

export interface CreateProductCategoryInput {
  storeId: string;
  name: string;
  parentId?: string;
}

export interface DeleteProductCategoryInput {
  storeId: string;
  categoryId: string;
}

export async function listProductCategories(
  storeId: string,
  options: ServiceOptions = {},
): Promise<ProductCategoryList> {
  const parsedStoreId = parseInt64(storeId, "店铺 ID 不正确");
  assertSupportedDataSource(options);
  const client = createClient(
    ProductTemplateService,
    createLocalTransport(options),
  );
  const response = await requestLocal("listProductCategories", () =>
    client.listProductCategories({ storeId: parsedStoreId }),
  );
  const categories = response.categories.map(mapCategory);

  if (
    categories.some((category) => category.storeId !== storeId) ||
    typeof response.hasUncategorizedProducts !== "boolean"
  ) {
    throw new FeatureUnavailableError("listProductCategories");
  }

  return {
    categories,
    hasUncategorizedProducts: response.hasUncategorizedProducts,
  };
}

export async function createProductCategory(
  input: CreateProductCategoryInput,
  options: ServiceOptions = {},
): Promise<ProductCategory> {
  const storeId = parseInt64(input.storeId, "店铺 ID 不正确");
  const parentId =
    input.parentId === undefined
      ? undefined
      : parseInt64(input.parentId, "上级分类 ID 不正确");
  const name = input.name.trim();
  if (!name) throw new ValidationError("分类名称不能为空");
  if ([...name].length > MAX_CATEGORY_NAME_LENGTH) {
    throw new ValidationError(
      `分类名称不能超过 ${MAX_CATEGORY_NAME_LENGTH} 字`,
    );
  }

  assertSupportedDataSource(options);
  const client = createClient(
    ProductTemplateService,
    createLocalTransport(options),
  );
  const response = await requestLocal("createProductCategory", () =>
    client.createProductCategory({
      storeId,
      ...(parentId === undefined ? {} : { parentId }),
      name,
    }),
  );
  if (!response.category)
    throw new FeatureUnavailableError("createProductCategory");
  const category = mapCategory(response.category);
  if (
    category.storeId !== input.storeId ||
    category.parentId !== (input.parentId ?? null)
  ) {
    throw new FeatureUnavailableError("createProductCategory");
  }
  return category;
}

export async function deleteProductCategory(
  input: DeleteProductCategoryInput,
  options: ServiceOptions = {},
): Promise<void> {
  const storeId = parseInt64(input.storeId, "店铺 ID 不正确");
  const categoryId = parseInt64(input.categoryId, "分类 ID 不正确");
  assertSupportedDataSource(options);
  const client = createClient(
    ProductTemplateService,
    createLocalTransport(options),
  );
  await requestLocal("deleteProductCategory", () =>
    client.deleteProductCategory({ storeId, categoryId }),
  );
}

function mapCategory(category: ProtoProductCategory): ProductCategory {
  if (
    category.id <= 0n ||
    category.storeId <= 0n ||
    (category.parentId !== undefined && category.parentId <= 0n) ||
    !category.name.trim() ||
    !Number.isInteger(category.sortOrder) ||
    category.sortOrder < 0
  ) {
    throw new FeatureUnavailableError("productCategory");
  }
  return {
    id: category.id.toString(),
    storeId: category.storeId.toString(),
    parentId: category.parentId?.toString() ?? null,
    name: category.name,
    sortOrder: category.sortOrder,
  };
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) throw new ValidationError(message);
  const parsed = BigInt(value);
  if (parsed > MAX_SIGNED_INT64) throw new ValidationError(message);
  return parsed;
}

function assertSupportedDataSource(options: ServiceOptions): void {
  const dataSource = resolveDataSource(options);
  if (dataSource !== "mock" && dataSource !== "local") {
    throw new FeatureUnavailableError("productCategories");
  }
}
