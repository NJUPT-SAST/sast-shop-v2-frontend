const desktopOrigin = "https://desktop.sast-shop.invalid";
const allowedReturnPaths = new Set(["/orders", "/shop"]);

export function sanitizeDesktopReturnTo(value: string | undefined) {
  if (!value) return "/orders";
  try {
    const target = new URL(value, desktopOrigin);
    if (
      target.origin !== desktopOrigin ||
      !allowedReturnPaths.has(target.pathname)
    ) {
      return "/orders";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/orders";
  }
}
