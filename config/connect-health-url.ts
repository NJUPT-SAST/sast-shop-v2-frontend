export function parseConnectHealthUrl(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) {
    throw new Error("CONNECT_HEALTH_URL is required");
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("CONNECT_HEALTH_URL must be an absolute HTTPS URL");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "CONNECT_HEALTH_URL must use HTTPS without credentials, query, or hash",
    );
  }

  return url.toString();
}
