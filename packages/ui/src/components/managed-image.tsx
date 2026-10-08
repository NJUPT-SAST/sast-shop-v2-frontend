"use client";

import { useState, type ReactNode } from "react";
import { RiFileDamageLine, RiImageLine } from "@remixicon/react";
import { ImagePreview } from "#components/image-preview";
import { Skeleton } from "#components/skeleton";
import {
  forgetLoadedImage,
  hasLoadedImage,
  rememberLoadedImage,
} from "#lib/loaded-images";
import { cn } from "#lib/utils";

type ImageState = "empty" | "loading" | "loaded" | "error";

export type ManagedImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fit?: "cover" | "contain";
  preview?: boolean;
  sizes?: string;
  progressive?: boolean;
  loading?: "lazy" | "eager";
};

export type ManagedImageRenderer = (props: {
  src: string;
  alt: string;
  className: string;
  sizes: string;
  stage: "thumbnail" | "display" | "original";
  loading: "lazy" | "eager";
  onLoad: () => void;
  onError: () => void;
}) => ReactNode;

type FrameProps = ManagedImageProps & {
  renderImage: ManagedImageRenderer;
  thumbnailSrc?: string;
  cacheKey?: string;
  original?: boolean;
  fallback?: ReactNode;
};

export function ManagedImageFrame(props: FrameProps) {
  return (
    <ImageFrame
      key={`${props.src ?? ""}:${props.cacheKey ?? ""}:${props.thumbnailSrc ?? ""}`}
      {...props}
    />
  );
}

function ImageFrame({
  src,
  alt,
  className,
  imageClassName,
  fit = "cover",
  preview = false,
  sizes = "96px",
  loading = "lazy",
  renderImage,
  thumbnailSrc,
  cacheKey,
  original = false,
  fallback,
}: FrameProps) {
  const currentSrc = src || null;
  const displayKey = cacheKey ?? currentSrc;
  const [state, setState] = useState<ImageState>(() =>
    initialImageState(displayKey),
  );
  const [thumbnailState, setThumbnailState] = useState<ImageState>(() =>
    initialImageState(thumbnailSrc ?? null),
  );
  const hasThumbnail = thumbnailState === "loaded";
  const showThumbnail =
    Boolean(thumbnailSrc) && state !== "loaded" && thumbnailState !== "error";
  const loadDisplay =
    !thumbnailSrc || state === "loaded" || thumbnailState !== "loading";
  const visible = state === "loaded" || hasThumbnail;

  const updateState = (nextState: ImageState) => {
    if (displayKey) {
      if (nextState === "loaded") rememberLoadedImage(displayKey);
      if (nextState === "error") forgetLoadedImage(displayKey);
    }
    setState(nextState);
  };
  const updateThumbnailState = (nextState: ImageState) => {
    if (thumbnailSrc) {
      if (nextState === "loaded") rememberLoadedImage(thumbnailSrc);
      if (nextState === "error") forgetLoadedImage(thumbnailSrc);
    }
    setThumbnailState(nextState);
  };
  const imageClasses = cn(
    "absolute inset-0 size-full",
    fit === "contain" ? "object-contain" : "object-cover",
    imageClassName,
  );
  const Icon = state === "error" ? RiFileDamageLine : RiImageLine;
  const content = (
    <div
      aria-busy={state === "loading" && !hasThumbnail}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-image-surface text-muted-foreground",
        preview ? "size-full" : className,
      )}
    >
      {fallback && state !== "loaded" ? fallback : null}
      {!visible && !fallback && state === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      {!visible && !fallback && state !== "loading" ? (
        <span
          role="img"
          aria-label={state === "error" ? "图片加载失败" : "暂无图片"}
          className="relative z-10 flex size-11 items-center justify-center rounded-md bg-card/70"
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      {showThumbnail
        ? renderImage({
            src: thumbnailSrc!,
            alt: "",
            sizes: "64px",
            stage: "thumbnail",
            loading,
            className: cn(imageClasses, !hasThumbnail && "opacity-0"),
            onLoad: () => updateThumbnailState("loaded"),
            onError: () => updateThumbnailState("error"),
          })
        : null}
      {currentSrc && loadDisplay && state !== "error"
        ? renderImage({
            src: currentSrc,
            alt,
            sizes,
            stage: original ? "original" : "display",
            loading: original || thumbnailSrc ? "eager" : loading,
            className: cn(imageClasses, state !== "loaded" && "opacity-0"),
            onLoad: () => updateState("loaded"),
            onError: () => updateState("error"),
          })
        : null}
      {state === "error" && fallback ? (
        <span
          role="status"
          className="absolute bottom-2 rounded-md bg-card/90 px-2 py-1 text-xs"
        >
          原图加载失败，请关闭后重试
        </span>
      ) : null}
    </div>
  );

  if (!preview) return content;

  return (
    <ImagePreview
      alt={alt}
      className={className}
      disabled={!currentSrc}
      image={
        <ManagedImageFrame
          src={currentSrc}
          alt={alt}
          fit="contain"
          className="size-full"
          original
          fallback={content}
          renderImage={renderImage}
        />
      }
    >
      {content}
    </ImagePreview>
  );
}

function initialImageState(src: string | null): ImageState {
  if (!src) return "empty";
  return hasLoadedImage(src) ? "loaded" : "loading";
}
