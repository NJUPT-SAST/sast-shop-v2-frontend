export type PullGestureAxis = "undetermined" | "horizontal" | "vertical"

const GESTURE_DIRECTION_THRESHOLD = 6

export function resolvePullGestureAxis(
  deltaX: number,
  deltaY: number
): PullGestureAxis {
  const horizontalDistance = Math.abs(deltaX)
  const verticalDistance = Math.abs(deltaY)

  if (
    Math.max(horizontalDistance, verticalDistance) <
    GESTURE_DIRECTION_THRESHOLD
  ) {
    return "undetermined"
  }

  return horizontalDistance >= verticalDistance ? "horizontal" : "vertical"
}
