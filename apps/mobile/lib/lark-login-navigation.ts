const defaultReturnTo = "/shop";

export function getMobileLoginReturnTo(search: string): string {
  const returnTo = new URLSearchParams(search).get("returnTo");
  if (
    !returnTo?.startsWith("/") ||
    returnTo.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(returnTo)
  ) {
    return defaultReturnTo;
  }

  const base = "https://mobile-login.invalid";
  const target = new URL(returnTo, base);
  if (
    target.origin !== base ||
    target.pathname === "/" ||
    target.pathname.startsWith("/api/")
  ) {
    return defaultReturnTo;
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

export function getMobileLoginUrl(href: string): string | null {
  const current = new URL(href);
  if (current.pathname === "/") return null;

  // Feishu validates the full H5 page path against its redirect URL list.
  // A full navigation to this one registered entry also resets the SDK bridge.
  const login = new URL("/", current.origin);
  login.searchParams.set(
    "returnTo",
    `${current.pathname}${current.search}${current.hash}`,
  );
  return login.href;
}
