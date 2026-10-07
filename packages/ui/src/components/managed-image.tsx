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
};

export type ManagedImageRenderer = (props: {
  src: string;
  alt: string;
  className: string;
  onLoad: () => void;
  onError: () => void;
}) => ReactNode;

export function ManagedImageFrame({
  src,
  alt,
  className,
  imageClassName,
  fit = "cover",
  preview = false,
  renderImage,
}: ManagedImageProps & { renderImage: ManagedImageRenderer }) {
  const currentSrc = src || null;
  const [imageState, setImageState] = useState<{
    src: string | null;
    state: ImageState;
  }>(() => ({ src: currentSrc, state: initialImageState(currentSrc) }));
  const state =
    imageState.src === currentSrc
      ? imageState.state
      : initialImageState(currentSrc);

  if (imageState.src !== currentSrc) {
    setImageState({ src: currentSrc, state });
  }

  const updateState = (nextState: ImageState) => {
    if (currentSrc) {
      if (nextState === "loaded") rememberLoadedImage(currentSrc);
      if (nextState === "error") forgetLoadedImage(currentSrc);
    }
    setImageState({ src: currentSrc, state: nextState });
  };
  const Icon = state === "error" ? RiFileDamageLine : RiImageLine;
  const content = (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-image-surface text-muted-foreground",
        preview ? "size-full" : className,
      )}
    >
      {state === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      {state !== "loaded" ? (
        <span className="relative z-10 flex size-11 items-center justify-center rounded-md bg-card/70">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      {currentSrc && state !== "error"
        ? renderImage({
            src: currentSrc,
            alt,
            className: cn(
              "absolute inset-0 size-full",
              fit === "contain" ? "object-contain" : "object-cover",
              state !== "loaded" && "opacity-0",
              imageClassName,
            ),
            onLoad: () => updateState("loaded"),
            onError: () => updateState("error"),
          })
        : null}
    </div>
  );

  if (!preview) return content;

  return (
    <ImagePreview
      key={currentSrc}
      alt={alt}
      className={className}
      disabled={state !== "loaded"}
      image={
        <ManagedImageFrame
          src={currentSrc}
          alt={alt}
          fit="contain"
          className="size-full"
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
