export type TabSwipeDirection = "previous" | "next";

export function resolveTabSwipe(
  start: { x: number; y: number },
  end: { x: number; y: number },
  threshold = 56,
): TabSwipeDirection | null {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (
    Math.abs(deltaX) < threshold ||
    Math.abs(deltaX) <= Math.abs(deltaY) * 1.2
  ) {
    return null;
  }

  return deltaX < 0 ? "next" : "previous";
}
