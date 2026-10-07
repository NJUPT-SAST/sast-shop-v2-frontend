const primaryRoutes = new Set(["/shop", "/group", "/orders", "/profile"]);

export type PageTransitionDirection = "forward" | "backward";

export function getPageTransitionDirection(
  previousPath: string,
  nextPath: string,
): PageTransitionDirection | null {
  if (
    previousPath === nextPath ||
    previousPath === "/" ||
    nextPath === "/" ||
    previousPath.startsWith("/auth/") ||
    nextPath.startsWith("/auth/")
  ) {
    return null;
  }

  const previousIsPrimary = primaryRoutes.has(previousPath);
  const nextIsPrimary = primaryRoutes.has(nextPath);
  if (previousIsPrimary && nextIsPrimary) return null;
  if (previousIsPrimary) return "forward";
  if (nextIsPrimary) return "backward";
  if (nextPath.startsWith(`${previousPath}/`)) return "forward";
  if (previousPath.startsWith(`${nextPath}/`)) return "backward";
  const previousSegments = previousPath.split("/").filter(Boolean);
  const nextSegments = nextPath.split("/").filter(Boolean);
  if (
    previousSegments[0] === nextSegments[0] &&
    previousSegments.length !== nextSegments.length
  ) {
    return nextSegments.length > previousSegments.length
      ? "forward"
      : "backward";
  }
  return null;
}
