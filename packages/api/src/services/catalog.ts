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
  const name = input.name.trim();
  const address = input.address.trim();
  const logoUrl = normalizeLogoUrl(input.logoUrl ?? "");
  const themeColor = (input.themeColor ?? DEFAULT_STORE_THEME_COLOR).trim();

  if (!name) throw new ValidationError("店铺名称不能为空");
  if (name.length > MAX_STORE_NAME_LENGTH) {
    throw new ValidationError(`店铺名称不能超过 ${MAX_STORE_NAME_LENGTH} 字`);
  }
  if (!address) throw new ValidationError("店铺地址不能为空");
  if (address.length > MAX_STORE_ADDRESS_LENGTH) {
    throw new ValidationError(
      `店铺地址不能超过 ${MAX_STORE_ADDRESS_LENGTH} 字`,
    );
  }
  if (!/^#[\da-f]{6}$/i.test(themeColor)) {
    throw new ValidationError("店铺主题色不正确");
  }

  return { name, address, logoUrl, themeColor };
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
