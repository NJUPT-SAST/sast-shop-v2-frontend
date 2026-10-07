"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RiCloseLine, RiZoomInLine } from "@remixicon/react";
import { Button } from "#components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "#components/dialog";
import { cn } from "#lib/utils";
import { registerDrawerHistory } from "#lib/drawer-history";
import { useImageGestures } from "#hooks/use-image-gestures";

export function ImagePreview({
  alt,
  className,
  disabled,
  children,
  image,
}: {
  alt: string;
  className?: string;
  disabled: boolean;
  children: ReactNode;
  image: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { viewportRef, transform, reset, handlers } = useImageGestures(open);
  const openRef = useRef(false);
  const id = useId();
  const changeOpen = useCallback(
    (nextOpen: boolean) => {
      openRef.current = nextOpen;
      setOpen(nextOpen);
      if (!nextOpen) reset();
    },
    [reset],
  );

  useEffect(() => {
    if (!open) return;
    return registerDrawerHistory({
      id,
      isOpen: () => openRef.current,
      onBack: () => changeOpen(false),
    });
  }, [open, id, changeOpen]);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`查看${alt || "商品图片"}大图`}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "relative block overflow-hidden text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-zoom-in",
            className,
          )}
        >
          {children}
          {!disabled ? (
            <span
              className="pointer-events-none absolute right-1 bottom-1 rounded-md bg-card/90 p-1 text-foreground"
              aria-hidden="true"
            >
              <RiZoomInLine className="size-4" />
            </span>
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        onClick={(event) => event.stopPropagation()}
        className="flex h-dvh max-h-dvh max-w-none flex-col gap-3 rounded-none p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-[85dvh] sm:max-h-[52rem] sm:max-w-5xl sm:rounded-xl"
      >
        <div className="flex shrink-0 items-center gap-3">
          <DialogTitle className="min-w-0 flex-1 truncate">
            {alt || "商品图片"}
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-touch" aria-label="关闭图片预览">
              <RiCloseLine />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          双指或滚轮缩放，拖拽调整位置，双击放大或复原；键盘加减号缩放，方向键移动，0
          复原
        </DialogDescription>
        <div
          ref={viewportRef}
          role="region"
          aria-label="图片查看区域"
          tabIndex={0}
          {...handlers}
          className="min-h-0 flex-1 touch-none overflow-hidden overscroll-contain rounded-lg bg-image-surface outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_img]:pointer-events-none"
          style={{ cursor: transform.scale > 1 ? "grab" : "zoom-in" }}
        >
          <div
            data-slot="image-preview-canvas"
            className="relative size-full"
            style={{
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            }}
          >
            {image}
          </div>
        </div>
        <p className="shrink-0 text-center text-xs text-muted-foreground">
          双击缩放，拖拽移动
        </p>
      </DialogContent>
    </Dialog>
  );
}
