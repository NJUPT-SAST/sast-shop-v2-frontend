export function resolveStoreCreateReturnPath(
  returnTo: string | undefined,
  storeId: string,
  origin: string,
): string {
  const fallback = `/group/templates?store=${encodeURIComponent(storeId)}`;
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(returnTo, origin);
    if (url.origin !== origin) return fallback;
    if (url.pathname === "/group/templates") {
      url.searchParams.set("store", storeId);
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
