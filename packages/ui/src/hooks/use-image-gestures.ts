"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type MouseEvent,
} from "react";

type Point = { x: number; y: number };
type Transform = Point & { scale: number };
type Gesture = { center: Point; distance: number; transform: Transform };
const initialTransform: Transform = { x: 0, y: 0, scale: 1 };
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

export function useImageGestures(active: boolean) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const attachViewport = useCallback((element: HTMLDivElement | null) => {
    viewportRef.current = element;
    setViewport(element);
  }, []);
  const [transform, setTransform] = useState(initialTransform);
  const transformRef = useRef(initialTransform);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const tapStart = useRef<{
    point: Point;
    time: number;
    eligible: boolean;
  } | null>(null);
  const lastTap = useRef<{ point: Point; time: number } | null>(null);
  const lastTouch = useRef(0);

  const updateTransform = useCallback((next: Transform) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;
    const image = viewport.querySelector("img");
    const ratio =
      image?.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : width / height;
    const imageWidth = Math.min(width, height * ratio);
    const imageHeight = Math.min(height, width / ratio);
    const scale = Math.max(1, Math.min(5, next.scale));
    const bounded = {
      scale,
      x: clamp(next.x, Math.max(0, (imageWidth * scale - width) / 2)),
      y: clamp(next.y, Math.max(0, (imageHeight * scale - height) / 2)),
    };
    transformRef.current = bounded;
    setTransform(bounded);
  }, []);

  const localPoint = useCallback((point: Point) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return {
      x: point.x - rect.left - rect.width / 2,
      y: point.y - rect.top - rect.height / 2,
    };
  }, []);

  const beginGesture = useCallback(() => {
    const [first, second] = [...pointers.current.values()];
    gesture.current = first
      ? {
          center: localPoint(second ? midpoint(first, second) : first),
          distance: second ? Math.max(1, distance(first, second)) : 0,
          transform: transformRef.current,
        }
      : null;
  }, [localPoint]);

  const zoomAt = useCallback(
    (scale: number, point: Point) => {
      const current = transformRef.current;
      const nextScale = Math.max(1, Math.min(5, scale));
      const factor = nextScale / current.scale;
      updateTransform({
        scale: nextScale,
        x: point.x - (point.x - current.x) * factor,
        y: point.y - (point.y - current.y) * factor,
      });
      beginGesture();
    },
    [updateTransform, beginGesture],
  );

  const reset = useCallback(() => {
    transformRef.current = initialTransform;
    setTransform(initialTransform);
    pointers.current.clear();
    gesture.current = null;
    tapStart.current = null;
    lastTap.current = null;
    lastTouch.current = 0;
  }, []);

  useEffect(() => {
    if (!active || !viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1);
      zoomAt(
        transformRef.current.scale *
          Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.01),
        localPoint({ x: event.clientX, y: event.clientY }),
      );
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateTransform(transformRef.current);
            beginGesture();
          });
    observer?.observe(viewport);
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      observer?.disconnect();
    };
  }, [active, viewport, localPoint, updateTransform, zoomAt, beginGesture]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    if (pointers.current.size >= 2) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    if (pointers.current.size === 1) {
      tapStart.current = { point, time: Date.now(), eligible: true };
    } else {
      if (tapStart.current) tapStart.current.eligible = false;
      lastTap.current = null;
    }
    beginGesture();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (tapStart.current && distance(tapStart.current.point, point) > 8)
      tapStart.current.eligible = false;
    const [first, second] = [...pointers.current.values()];
    const center = localPoint(second ? midpoint(first!, second) : first!);
    const start = gesture.current;
    const scale = second
      ? Math.max(
          1,
          Math.min(
            5,
            (start.transform.scale * distance(first!, second)) / start.distance,
          ),
        )
      : start.transform.scale;
    const factor = scale / start.transform.scale;
    updateTransform({
      scale,
      x: center.x - (start.center.x - start.transform.x) * factor,
      y: center.y - (start.center.y - start.transform.y) * factor,
    });
  };

  const endPointer = (
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      const point = { x: event.clientX, y: event.clientY };
      const time = Date.now();
      lastTouch.current = time;
      if (
        !cancelled &&
        tapStart.current?.eligible &&
        time - tapStart.current.time < 300
      ) {
        if (
          lastTap.current &&
          time - lastTap.current.time < 300 &&
          distance(lastTap.current.point, point) < 24
        ) {
          zoomAt(transformRef.current.scale > 1 ? 1 : 2.5, localPoint(point));
          lastTap.current = null;
        } else lastTap.current = { point, time };
      } else lastTap.current = null;
    }
    beginGesture();
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      Date.now() - lastTouch.current < 500 ||
      tapStart.current?.eligible === false
    )
      return;
    zoomAt(
      transformRef.current.scale > 1 ? 1 : 2.5,
      localPoint({ x: event.clientX, y: event.clientY }),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = transformRef.current;
    if (
      [
        "+",
        "=",
        "-",
        "0",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "0") reset();
      else if (["+", "=", "-"].includes(event.key))
        zoomAt(current.scale * (event.key === "-" ? 0.8 : 1.25), {
          x: 0,
          y: 0,
        });
      else {
        updateTransform({
          ...current,
          x:
            current.x +
            (event.key === "ArrowLeft"
              ? 40
              : event.key === "ArrowRight"
                ? -40
                : 0),
          y:
            current.y +
            (event.key === "ArrowUp"
              ? 40
              : event.key === "ArrowDown"
                ? -40
                : 0),
        });
        beginGesture();
      }
    }
  };

  return {
    viewportRef: attachViewport,
    transform,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => endPointer(event),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) =>
        endPointer(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) =>
        endPointer(event, true),
      onDoubleClick,
      onKeyDown,
      onDragStart: (event: React.DragEvent) => event.preventDefault(),
    },
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
