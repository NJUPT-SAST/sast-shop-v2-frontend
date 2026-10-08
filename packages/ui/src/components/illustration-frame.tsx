"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Skeleton } from "#components/skeleton";
import {
  forgetLoadedImage,
  hasLoadedImage,
  rememberLoadedImage,
} from "#lib/loaded-images";
import { cn } from "#lib/utils";

type IllustrationFrameProps = {
  src: string;
  size: number;
  className?: string;
  fallback: ReactNode;
  renderImage: (props: {
    className: string;
    onLoad: () => void;
    onError: () => void;
  }) => ReactNode;
};

export function IllustrationFrame(props: IllustrationFrameProps) {
  return <IllustrationContent key={props.src} {...props} />;
}

function IllustrationContent({
  src,
  size,
  className,
  fallback,
  renderImage,
}: IllustrationFrameProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(() =>
    hasLoadedImage(src) ? "loaded" : "loading",
  );

  return (
    <span
      aria-hidden="true"
      data-slot="illustration-frame"
      className={cn(
        "relative inline-flex size-[var(--illustration-size)] shrink-0 items-center justify-center",
        className,
      )}
      style={{ "--illustration-size": `${size}px` } as CSSProperties}
    >
      {state === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-xl opacity-50" />
      ) : null}
      {state === "error" ? (
        <span className="inline-flex size-full items-center justify-center text-muted-foreground [&>svg]:size-3/5">
          {fallback}
        </span>
      ) : (
        renderImage({
          className: cn(
            "absolute inset-0 size-full object-contain transition-opacity duration-200 motion-reduce:transition-none",
            state !== "loaded" && "opacity-0",
          ),
          onLoad: () => {
            rememberLoadedImage(src);
            setState("loaded");
          },
          onError: () => {
            forgetLoadedImage(src);
            setState("error");
          },
        })
      )}
    </span>
  );
}
