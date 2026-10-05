export function resolveFeishuRedirectUri(
  value: string | undefined,
  appOrigin: string,
  production = false,
): string {
  const url = new URL(value?.trim() || "/", appOrigin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (production && url.protocol !== "https:") ||
    url.origin !== new URL(appOrigin).origin ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("NEXT_PUBLIC_FEISHU_REDIRECT_URI 必须是当前应用的根地址");
  }
  return url.href;
}

export function getFeishuLoginRedirect(
  currentHref: string,
  redirectUri: string,
): string | null {
  const current = new URL(currentHref);
  const entry = new URL(resolveFeishuRedirectUri(redirectUri, current.origin));
  if (current.pathname === entry.pathname) return null;
  entry.searchParams.set(
    "returnTo",
    `${current.pathname}${current.search}${current.hash}`,
  );
  return entry.href;
}

export function getFeishuLoginReturnTo(value: string | null): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return "/shop";
  const url = new URL(value, "https://app.local");
  if (
    url.origin !== "https://app.local" ||
    url.pathname === "/" ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/auth/callback"
  )
    return "/shop";
  return `${url.pathname}${url.search}${url.hash}`;
}
