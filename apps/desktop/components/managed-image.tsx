"use client";

import { useState } from "react";
import Image from "next/image";
import { RiFileDamageLine, RiImageLine } from "@remixicon/react";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";

export function ManagedImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const currentSrc = src || null;
  const [state, setState] = useState<{
    src: string | null;
    loaded: boolean;
    failed: boolean;
  }>({
    src: currentSrc,
    loaded: false,
    failed: false,
  });
  const current =
    state.src === currentSrc
      ? state
      : { src: currentSrc, loaded: false, failed: false };
  const Icon = current.failed ? RiFileDamageLine : RiImageLine;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-image-surface text-muted-foreground",
        className,
      )}
    >
      {currentSrc && !current.loaded && !current.failed ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      {!current.loaded ? (
        <Icon className="relative z-10 size-8" aria-hidden="true" />
      ) : null}
      {currentSrc && !current.failed ? (
        <Image
          src={currentSrc}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 1200px) 33vw, 280px"
          className={cn("object-cover", !current.loaded && "opacity-0")}
          onLoad={() =>
            setState({ src: currentSrc, loaded: true, failed: false })
          }
          onError={() =>
            setState({ src: currentSrc, loaded: false, failed: true })
          }
        />
      ) : null}
    </div>
  );
}
