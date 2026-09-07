import { createClient } from "@connectrpc/connect";

import type { ProductTemplate as ProtoProductTemplate } from "../gen/sast/sastshopv2/catalog/v1/product_template_pb";
import { ProductTemplateService } from "../gen/sast/sastshopv2/catalog/v1/product_template_service_pb";
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createPageResult, type PageResult } from "../pagination";
import { createLocalTransport, requestLocal } from "../local-connect";
import { formatProtoTimestamp, parseProtoTimestamp } from "../proto-timestamp";
import { listStores, type Store } from "./catalog";

const MAX_SIGNED_INT64 = 9223372036854775807n;
const MAX_SIGNED_INT32 = 2147483647;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_BARCODE_LENGTH = 64;
const MAX_IMAGE_URL_LENGTH = 2048;

export interface ProductTemplate {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  storeId: string;
  mainImageUrl: string;
  barcode: string;
  updatedAt: string | null;
}

export interface ProductTemplateMatch {
  productTemplate: ProductTemplate;
  store: Store | null;
}

export interface CreateProductTemplateInput {
  storeId: string;
  title: string;
  description: string;
  priceCents: number;
  mainImageUrl: string;
  barcode: string;
}

export interface UpdateProductTemplatePatch {
  storeId?: string;
  title?: string;
  description?: string;
  priceCents?: number;
  mainImageUrl?: string;
  barcode?: string;
}

export interface UpdateProductTemplateInput {
  id: string;
  updatedAt: string;
  patch: UpdateProductTemplatePatch;
}

export interface DeleteProductTemplateInput {
  id: string;
}

export async function listProductTemplates(
  options: ServiceOptions & {
    storeId?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ProductTemplate[]> {
  const result = await listProductTemplatesPage(options);
  return result.items;
}

export async function listProductTemplatesPage(
  options: ServiceOptions & {
    storeId?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PageResult<ProductTemplate>> {
  const dataSource = resolveDataSource(options);
  const page = parsePositiveInteger(options.page ?? 1, "页码不正确");
  const pageSize = parsePositiveInteger(
    options.pageSize ?? 50,
    "每页数量不正确",
  );

  if (dataSource === "mock" || dataSource === "local") {
    if (options.storeId !== undefined) {
      return listTemplatesByStorePage(options.storeId, {
        ...options,
        page,
        pageSize,
      });
    }

    const stores = await listStores(options);
    const pages = await Promise.all(
      stores.map((store) =>
        listTemplatesByStorePage(store.id, { ...options, page, pageSize }),
      ),
    );

    return createPageResult({
      items: pages.flatMap((result) => result.items),
      currentPage: page,
      pageSize,
      totalCount: pages.reduce((total, result) => total + result.totalCount, 0),
      expectedPage: page,
      feature: "listProductTemplates",
      hasMore: pages.some((result) => result.hasMore),
      maxItems: pageSize * stores.length,
      validateOffset: false,
    });
  }

  throw new FeatureUnavailableError("listProductTemplates");
}

export async function getProductTemplatesByBarcode(
  barcode: string,
  options: ServiceOptions = {},
): Promise<ProductTemplateMatch[]> {
  const normalizedBarcode = normalizeBarcode(barcode);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ProductTemplateService,
      createLocalTransport(options),
    );
    const response = await requestLocal("getProductTemplatesByBarcode", () =>
      client.getProductTemplateByBarcode({ barcode: normalizedBarcode }),
    );

    const matches = response.items.map((item) => {
      if (!item.productTemplate) {
        throw new FeatureUnavailableError("getProductTemplatesByBarcode");
      }

      const productTemplate = mapTemplate(item.productTemplate);
      const store = mapStore(item.store);

      if (store && store.id !== productTemplate.storeId) {
        throw new FeatureUnavailableError("getProductTemplatesByBarcode");
      }

      return { productTemplate, store };
    });

    const matchKeys = new Set<string>();
    for (const match of matches) {
      const key = `${match.productTemplate.storeId}:${match.productTemplate.barcode}`;
      if (matchKeys.has(key)) {
        throw new FeatureUnavailableError("getProductTemplatesByBarcode");
      }
      matchKeys.add(key);
    }

    return matches;
  }

  throw new FeatureUnavailableError("getProductTemplatesByBarcode");
}

export async function createProductTemplate(
  input: CreateProductTemplateInput,
  options: ServiceOptions = {},
): Promise<ProductTemplate> {
  const parsedInput = validateCreateProductTemplateInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ProductTemplateService,
      createLocalTransport(options),
    );
    const response = await requestLocal("createProductTemplate", () =>
      client.createProductTemplate(parsedInput),
    );

    if (!response.productTemplate) {
      throw new FeatureUnavailableError("createProductTemplate");
    }

    return mapTemplate(response.productTemplate);
  }

  throw new FeatureUnavailableError("createProductTemplate");
}

export async function updateProductTemplate(
  input: UpdateProductTemplateInput,
  options: ServiceOptions = {},
): Promise<ProductTemplate> {
  const parsedInput = validateUpdateProductTemplateInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ProductTemplateService,
      createLocalTransport(options),
    );
    const response = await requestLocal("updateProductTemplate", () =>
      client.updateProductTemplate(parsedInput),
    );

    if (!response.productTemplate) {
      throw new FeatureUnavailableError("updateProductTemplate");
    }

    return mapTemplate(response.productTemplate);
  }

  throw new FeatureUnavailableError("updateProductTemplate");
}

export async function deleteProductTemplate(
  input: DeleteProductTemplateInput,
  options: ServiceOptions = {},
): Promise<void> {
  const productTemplateId = parseInt64(input.id, "商品模板 ID 不正确");
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(
      ProductTemplateService,
      createLocalTransport(options),
    );
    await requestLocal("deleteProductTemplate", () =>
      client.deleteProductTemplate({ productTemplateId }),
    );
    return;
  }

  throw new FeatureUnavailableError("deleteProductTemplate");
}

async function listTemplatesByStorePage(
  storeId: string,
  options: ServiceOptions & { page?: number; pageSize?: number },
): Promise<PageResult<ProductTemplate>> {
  const parsedStoreId = parseInt64(storeId, "店铺 ID 不正确");
  const page = parsePositiveInteger(options.page ?? 1, "页码不正确");
  const pageSize = parsePositiveInteger(
    options.pageSize ?? 50,
    "每页数量不正确",
  );
  const client = createClient(
    ProductTemplateService,
    createLocalTransport(options),
  );
  const response = await requestLocal("listProductTemplates", () =>
    client.getProductTemplateList({
      storeId: parsedStoreId,
      page,
      pageSize,
    }),
  );
  const items = response.productTemplates.map(mapTemplate);

  return createPageResult({
    items,
    currentPage: response.currentPage,
    pageSize,
    totalCount: response.totalCount,
    expectedPage: page,
    feature: "listProductTemplates",
  });
}

function validateCreateProductTemplateInput(input: CreateProductTemplateInput) {
  return {
    storeId: parseInt64(input.storeId, "店铺 ID 不正确"),
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    priceCents: normalizePrice(input.priceCents),
    mainImageUrl: normalizeImageUrl(input.mainImageUrl),
    barcode: normalizeBarcode(input.barcode),
  };
}

function validateUpdateProductTemplateInput(input: UpdateProductTemplateInput) {
  const keys = Object.keys(input.patch) as Array<
    keyof UpdateProductTemplatePatch
  >;

  if (keys.length === 0) {
    throw new ValidationError("至少修改一个商品模板字段");
  }

  if (keys.some((key) => input.patch[key] === undefined)) {
    throw new ValidationError("商品模板更新字段不正确");
  }

  const allowedKeys: Array<keyof UpdateProductTemplatePatch> = [
    "storeId",
    "title",
    "description",
    "priceCents",
    "mainImageUrl",
    "barcode",
  ];

  if (keys.some((key) => !allowedKeys.includes(key))) {
    throw new ValidationError("商品模板更新字段不正确");
  }

  const storeId =
    input.patch.storeId === undefined
      ? undefined
      : parseInt64(input.patch.storeId, "店铺 ID 不正确");
  const title =
    input.patch.title === undefined
      ? undefined
      : normalizeTitle(input.patch.title);
  const description =
    input.patch.description === undefined
      ? undefined
      : normalizeDescription(input.patch.description);
  const priceCents =
    input.patch.priceCents === undefined
      ? undefined
      : normalizePrice(input.patch.priceCents);
  const mainImageUrl =
    input.patch.mainImageUrl === undefined
      ? undefined
      : normalizeImageUrl(input.patch.mainImageUrl);
  const barcode =
    input.patch.barcode === undefined
      ? undefined
      : normalizeBarcode(input.patch.barcode);

  const pathByKey: Record<keyof UpdateProductTemplatePatch, string> = {
    storeId: "store_id",
    title: "title",
    description: "description",
    priceCents: "price_cents",
    mainImageUrl: "main_image_url",
    barcode: "barcode",
  };

  return {
    productTemplate: {
      id: parseInt64(input.id, "商品模板 ID 不正确"),
      updatedAt: parseTimestamp(input.updatedAt),
      ...(storeId === undefined ? {} : { storeId }),
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
      ...(priceCents === undefined ? {} : { priceCents }),
      ...(mainImageUrl === undefined ? {} : { mainImageUrl }),
      ...(barcode === undefined ? {} : { barcode }),
    },
    updateMask: {
      paths: keys.map((key) => pathByKey[key]),
    },
  };
}

function mapTemplate(template: ProtoProductTemplate): ProductTemplate {
  return {
    id: template.id.toString(),
    title: template.title,
    description: template.description,
    priceCents: template.priceCents,
    storeId: template.storeId.toString(),
    mainImageUrl: template.mainImageUrl,
    barcode: template.barcode,
    updatedAt: formatProtoTimestamp(template.updatedAt),
  };
}

function mapStore(store?: ProtoStore): Store | null {
  if (!store) return null;

  return {
    id: store.id.toString(),
    name: store.name,
    address: store.address,
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
  };
}

function normalizeTitle(value: string): string {
  const title = value.trim();

  if (!title) throw new ValidationError("商品名称不能为空");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`商品名称不能超过 ${MAX_TITLE_LENGTH} 字`);
  }

  return title;
}

function normalizeDescription(value: string): string {
  const description = value.trim();

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`商品规格不能超过 ${MAX_DESCRIPTION_LENGTH} 字`);
  }

  return description;
}

function normalizePrice(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError("商品价格不正确");
  }

  return value;
}

function normalizeBarcode(value: string): string {
  const barcode = value.trim();

  if (!barcode) throw new ValidationError("商品条码不能为空");
  if (!/^\d+$/.test(barcode)) {
    throw new ValidationError("商品条码只能包含数字");
  }
  if (barcode.length > MAX_BARCODE_LENGTH) {
    throw new ValidationError(`商品条码不能超过 ${MAX_BARCODE_LENGTH} 位`);
  }

  return barcode;
}

function normalizeImageUrl(value: string): string {
  const imageUrl = value.trim();

  if (!imageUrl) return "";
  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
    throw new ValidationError("商品图片地址不正确");
  }

  try {
    const url = new URL(imageUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      isPrivateImageHost(url.hostname)
    ) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new ValidationError("商品图片地址不正确");
  }

  return imageUrl;
}

function isPrivateImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  if (host.includes(":")) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;

  const octets = ipv4.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return true;

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function parseInt64(value: string, message: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) throw new ValidationError(message);

  const parsed = BigInt(value);
  if (parsed > MAX_SIGNED_INT64) throw new ValidationError(message);

  return parsed;
}

function parsePositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SIGNED_INT32) {
    throw new ValidationError(message);
  }

  return value;
}

function parseTimestamp(value: string) {
  return parseProtoTimestamp(value, "商品模板更新时间不正确");
}
