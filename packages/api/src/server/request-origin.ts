export function hasTrustedRequestOrigin(
  headers: Headers,
  configuredAppOrigin: string,
): boolean {
  let appUrl: URL;
  try {
    appUrl = new URL(configuredAppOrigin);
  } catch {
    return false;
  }
  if (
    !["http:", "https:"].includes(appUrl.protocol) ||
    appUrl.username ||
    appUrl.password ||
    appUrl.pathname !== "/" ||
    appUrl.search ||
    appUrl.hash
  ) {
    return false;
  }

  // Reverse proxies can expose an internal HTTP URL to the request handler.
  const origin = headers.get("origin");
  if (origin !== null) return origin === appUrl.origin;

  const referer = headers.get("referer");
  if (!referer) return false;
  try {
    const refererUrl = new URL(referer);
    return (
      ["http:", "https:"].includes(refererUrl.protocol) &&
      !refererUrl.username &&
      !refererUrl.password &&
      refererUrl.origin === appUrl.origin
    );
  } catch {
    return false;
  }
}
