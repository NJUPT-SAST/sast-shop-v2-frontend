export const TEMPLATE_STORE_STORAGE_KEY = "sast-shop.product-template-store";

export function readTemplateStoreId(
  storage: Pick<Storage, "getItem"> | undefined = getBrowserStorage(),
): string | null {
  try {
    return storage?.getItem(TEMPLATE_STORE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function resolveTemplateStoreId(
  {
    stores,
    requestedStoreId,
    fallbackStoreId,
  }: {
    stores: ReadonlyArray<{ id: string }>;
    requestedStoreId?: string;
    fallbackStoreId: string | null;
  },
  storage: Pick<Storage, "getItem"> | undefined = getBrowserStorage(),
): string | null {
  const exists = (id: string | null | undefined): id is string =>
    Boolean(id && stores.some((store) => store.id === id));
  if (exists(requestedStoreId)) return requestedStoreId;
  const rememberedStoreId = readTemplateStoreId(storage);
  if (exists(rememberedStoreId)) return rememberedStoreId;
  return exists(fallbackStoreId) ? fallbackStoreId : (stores[0]?.id ?? null);
}

export function rememberTemplateStoreId(
  storeId: string,
  storage: Pick<Storage, "setItem"> | undefined = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(TEMPLATE_STORE_STORAGE_KEY, storeId);
    return true;
  } catch {
    return false;
  }
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
