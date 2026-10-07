import { createClient } from "@connectrpc/connect";
import type { Store as ProtoStore } from "../gen/sast/sastshopv2/catalog/v1/store_pb";
import { CatalogService } from "../gen/sast/sastshopv2/catalog/v1/store_service_pb";
import { resolveDataSource, type ServiceOptions } from "../data-source";
import { FeatureUnavailableError, ValidationError } from "../errors";
import { createLocalTransport, requestLocal } from "../local-connect";

const MAX_STORE_NAME_LENGTH = 100;
const MAX_STORE_ADDRESS_LENGTH = 200;
const MAX_STORE_LOGO_URL_LENGTH = 2048;
const DEFAULT_STORE_THEME_COLOR = "#c9431f";
const MAX_SIGNED_INT64 = 9223372036854775807n;

export interface Store {
  id: string;
  name: string;
  address: string;
  logoUrl: string;
  themeColor: string;
}

export interface CreateStoreInput {
  name: string;
  address: string;
  logoUrl?: string;
  themeColor?: string;
}

export interface UpdateStorePatch {
  name?: string;
  address?: string;
  logoUrl?: string;
  themeColor?: string;
}

export interface UpdateStoreInput {
  id: string;
  patch: UpdateStorePatch;
}

export async function listStores(
  options: ServiceOptions = {},
): Promise<Store[]> {
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(CatalogService, createLocalTransport(options));
    const response = await requestLocal("listStores", () =>
      client.getStoreList({}),
    );

    return response.stores.map(mapStore);
  }

  throw new FeatureUnavailableError("listStores");
}

export async function createStore(
  input: CreateStoreInput,
  options: ServiceOptions = {},
): Promise<Store> {
  const parsedInput = validateCreateStoreInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(CatalogService, createLocalTransport(options));
    const response = await requestLocal("createStore", () =>
      client.createStore(parsedInput),
    );

    if (!response.store) {
      throw new FeatureUnavailableError("createStore");
    }

    return mapStore(response.store);
  }

  throw new FeatureUnavailableError("createStore");
}

export async function updateStore(
  input: UpdateStoreInput,
  options: ServiceOptions = {},
): Promise<Store> {
  const parsedInput = validateUpdateStoreInput(input);
  const dataSource = resolveDataSource(options);

  if (dataSource === "mock" || dataSource === "local") {
    const client = createClient(CatalogService, createLocalTransport(options));
    const response = await requestLocal("updateStore", () =>
      client.updateStore(parsedInput),
    );
    if (!response.store) throw new FeatureUnavailableError("updateStore");
    return mapStore(response.store);
  }

  throw new FeatureUnavailableError("updateStore");
}

function validateUpdateStoreInput(input: UpdateStoreInput) {
  if (!/^[1-9]\d*$/.test(input.id) || BigInt(input.id) > MAX_SIGNED_INT64) {
    throw new ValidationError("店铺 ID 不正确");
  }

  const keys = Object.keys(input.patch) as Array<keyof UpdateStorePatch>;
  const paths = {
    name: "name",
    address: "address",
    logoUrl: "logo_url",
    themeColor: "theme_color",
  };
  if (keys.length === 0) throw new ValidationError("至少修改一个店铺字段");
  if (
    keys.some(
      (key) =>
        !Object.hasOwn(paths, key) || typeof input.patch[key] !== "string",
    )
  ) {
    throw new ValidationError("店铺更新字段不正确");
  }

  const store: Partial<Omit<ProtoStore, "$typeName">> = { id: BigInt(input.id) };
  if (input.patch.name !== undefined)
    store.name = normalizeStoreName(input.patch.name);
  if (input.patch.address !== undefined)
    store.address = normalizeStoreAddress(input.patch.address);
  if (input.patch.logoUrl !== undefined)
    store.logoUrl = normalizeLogoUrl(input.patch.logoUrl);
  if (input.patch.themeColor !== undefined)
    store.themeColor = normalizeThemeColor(input.patch.themeColor);

  return { store, updateMask: { paths: keys.map((key) => paths[key]) } };
}

function mapStore(store: ProtoStore): Store {
  return {
    id: store.id.toString(),
    name: store.name,
    address: store.address,
    logoUrl: store.logoUrl,
    themeColor: store.themeColor,
  };
}

function validateCreateStoreInput(input: CreateStoreInput) {
  return {
    name: normalizeStoreName(input.name),
    address: normalizeStoreAddress(input.address),
    logoUrl: normalizeLogoUrl(input.logoUrl ?? ""),
    themeColor: normalizeThemeColor(
      input.themeColor ?? DEFAULT_STORE_THEME_COLOR,
    ),
  };
}

function normalizeStoreName(value: string): string {
  const name = value.trim();
  if (!name) throw new ValidationError("店铺名称不能为空");
  if (name.length > MAX_STORE_NAME_LENGTH) {
    throw new ValidationError(`店铺名称不能超过 ${MAX_STORE_NAME_LENGTH} 字`);
  }
  return name;
}

function normalizeStoreAddress(value: string): string {
  const address = value.trim();
  if (!address) throw new ValidationError("店铺地址不能为空");
  if (address.length > MAX_STORE_ADDRESS_LENGTH) {
    throw new ValidationError(
      `店铺地址不能超过 ${MAX_STORE_ADDRESS_LENGTH} 字`,
    );
  }
  return address;
}

function normalizeThemeColor(value: string): string {
  const themeColor = value.trim();
  if (!/^#[\da-f]{6}$/i.test(themeColor)) {
    throw new ValidationError("店铺主题色不正确");
  }
  return themeColor;
}

function normalizeLogoUrl(value: string): string {
  const logoUrl = value.trim();

  if (!logoUrl) return "";
  if (logoUrl.length > MAX_STORE_LOGO_URL_LENGTH) {
    throw new ValidationError("店铺 Logo 地址不正确");
  }

  try {
    const url = new URL(logoUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("unsupported URL");
    }
  } catch {
    throw new ValidationError("店铺 Logo 地址不正确");
  }

  return logoUrl;
}
