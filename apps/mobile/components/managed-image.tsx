"use client";

import { useState } from "react";
import Image from "next/image";
import { RiFileDamageLine, RiImageLine } from "@remixicon/react";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  forgetLoadedImage,
  hasLoadedImage,
  rememberLoadedImage,
} from "@workspace/ui/lib/loaded-images";
import { cn } from "@workspace/ui/lib/utils";

type ImageState = "empty" | "loading" | "loaded" | "error";

export function ManagedImage({
  src,
  alt,
  className,
  imageClassName,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  const currentSrc = src ?? null;
  const [imageState, setImageState] = useState<{
    src: string | null;
    state: ImageState;
  }>(() => ({
    src: currentSrc,
    state: initialImageState(currentSrc),
  }));
  const state =
    imageState.src === currentSrc
      ? imageState.state
      : initialImageState(currentSrc);

  if (imageState.src !== currentSrc) {
    setImageState({ src: currentSrc, state });
  }

  const Icon = state === "error" ? RiFileDamageLine : RiImageLine;
  const imageSrc = currentSrc && state !== "error" ? currentSrc : null;
  const updateState = (nextState: ImageState) => {
    if (currentSrc) {
      if (nextState === "loaded") rememberLoadedImage(currentSrc);
      if (nextState === "error") forgetLoadedImage(currentSrc);
    }
    setImageState({ src: currentSrc, state: nextState });
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-image-surface text-muted-foreground",
        className,
      )}
    >
      {state === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      {state !== "loaded" ? (
        <span className="relative z-10 flex size-11 items-center justify-center rounded-md bg-card/70">
          <Icon className="size-6" />
        </span>
      ) : null}
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized
          className={cn(
            "absolute inset-0 size-full object-cover",
            state !== "loaded" && "opacity-0",
            imageClassName,
          )}
          onLoad={() => updateState("loaded")}
          onError={() => updateState("error")}
        />
      ) : null}
    </div>
  );
}

function initialImageState(src: string | null): ImageState {
  if (!src) return "empty";
  return hasLoadedImage(src) ? "loaded" : "loading";
}
