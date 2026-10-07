import { getFeishuLoginReturnTo } from "./feishu-redirect-uri";

const authorizationParameters = new Set([
  "code",
  "state",
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "authorization_code",
  "user_access_token",
  "app_access_token",
  "tenant_access_token",
]);

function sanitizeTarget(url: URL, depth = 0): URL {
  if (url.pathname === "/auth/callback" || url.pathname.startsWith("/api/")) {
    return new URL("/shop", url.origin);
  }
  for (const key of Array.from(url.searchParams.keys())) {
    if (authorizationParameters.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  const fragment = new URLSearchParams(url.hash.slice(1).split("?").at(-1));
  if (
    Array.from(fragment.keys()).some((key) =>
      authorizationParameters.has(key.toLowerCase()),
    )
  ) {
    url.hash = "";
  }
  const returnTo = url.searchParams.get("returnTo");
  if (returnTo !== null) {
    if (depth >= 2) {
      url.searchParams.delete("returnTo");
    } else {
      const target = sanitizeTarget(
        new URL(getFeishuLoginReturnTo(returnTo), url.origin),
        depth + 1,
      );
      url.searchParams.set(
        "returnTo",
        `${target.pathname}${target.search}${target.hash}`,
      );
    }
  }
  return url;
}

export function getFeishuAppLink(
  appId: string,
  currentHref: string,
): string | null {
  if (!appId.trim()) return null;
  let target: URL;
  try {
    target = new URL(currentHref);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password
  ) {
    return null;
  }
  const link = new URL("https://applink.feishu.cn/client/web_app/open");
  link.searchParams.set("appId", appId.trim());
  link.searchParams.set("lk_target_url", sanitizeTarget(target).href);
  return link.href;
}

export function openFeishuAppOnce(
  appId: string,
  browser: Pick<Window, "location" | "sessionStorage">,
): string | null {
  const href = getFeishuAppLink(appId, browser.location.href);
  if (!href) return null;
  try {
    const storageKey = `sast-shop:feishu-app-open:${appId.trim()}`;
    if (browser.sessionStorage.getItem(storageKey)) return href;
    browser.sessionStorage.setItem(storageKey, "1");
    if (browser.sessionStorage.getItem(storageKey) !== "1") return href;
    browser.location.assign(href);
  } catch {
    return href;
  }
  return href;
}
