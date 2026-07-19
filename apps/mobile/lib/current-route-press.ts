export function resolveCurrentRoutePress(
  scrollTop: number,
  trackedAtTop: boolean,
): "scroll-to-top" | "refresh" {
  return scrollTop > 2 || !trackedAtTop ? "scroll-to-top" : "refresh";
}
