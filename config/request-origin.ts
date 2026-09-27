// The proxy preserves Host, while Next's URL can contain the container's
// listening address. Only the configured public origin is a trust anchor.
export function hasExpectedRequestHost(
  headers: Headers,
  appOrigin: string,
): boolean {
  try {
    const expected = new URL(appOrigin);
    if (
      !["http:", "https:"].includes(expected.protocol) ||
      expected.username ||
      expected.password ||
      expected.pathname !== "/" ||
      expected.search ||
      expected.hash
    )
      return false;

    const host = headers.get("host")?.toLowerCase();
    if (!host) return false;
    const defaultPort = expected.protocol === "https:" ? "443" : "80";
    return (
      host === expected.host ||
      (!expected.port && host === `${expected.host}:${defaultPort}`)
    );
  } catch {
    return false;
  }
}

export function isSameOriginRequest(
  headers: Headers,
  appOrigin: string,
): boolean {
  if (!hasExpectedRequestHost(headers, appOrigin)) return false;
  const expectedOrigin = new URL(appOrigin).origin;
  const origin = headers.get("origin");
  // An explicitly supplied Origin must be an origin, never a URL or "null".
  if (origin !== null) return origin === expectedOrigin;

  const referer = headers.get("referer");
  if (!referer) return false;
  try {
    const source = new URL(referer);
    return (
      !source.username && !source.password && source.origin === expectedOrigin
    );
  } catch {
    return false;
  }
}
