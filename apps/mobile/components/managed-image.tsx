"use client"

import { useState } from "react"
import { RiFileDamageLine, RiImageLine } from "@remixicon/react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

type ImageState = "empty" | "loading" | "loaded" | "error"

export function ManagedImage({
  src,
  alt,
  className,
  imageClassName,
}: {
  src?: string | null
  alt: string
  className?: string
  imageClassName?: string
}) {
  const currentSrc = src ?? null
  const [imageState, setImageState] = useState<{
    src: string | null
    state: ImageState
  }>({
    src: currentSrc,
    state: currentSrc ? "loading" : "empty",
  })
  const state =
    imageState.src === currentSrc
      ? imageState.state
      : currentSrc
        ? "loading"
        : "empty"

  const Icon = state === "error" ? RiFileDamageLine : RiImageLine
  const showImage = Boolean(src) && state !== "error"
  const updateState = (nextState: ImageState) => {
    setImageState({ src: currentSrc, state: nextState })
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        className
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
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          className={cn(
            "absolute inset-0 size-full object-cover",
            state !== "loaded" && "opacity-0",
            imageClassName
          )}
          onLoad={() => updateState("loaded")}
          onError={() => updateState("error")}
        />
      ) : null}
    </div>
  )
}
