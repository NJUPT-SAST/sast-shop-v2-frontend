"use client";

import Image from "next/image";
import soldOutImage from "../public/brand/sold-out-compact.webp";
import {
  ManagedImageFrame,
  type ManagedImageProps,
  type ManagedImageRenderer,
} from "@workspace/ui/components/managed-image";
import {
  canOptimizeImage,
  imageDisplayCacheKey,
  imageOptimizationSrc,
  imageThumbnailSrc,
} from "@workspace/ui/lib/image-variants";

const renderImage: ManagedImageRenderer = ({ stage, ...props }) => (
  <Image
    key={stage}
    {...props}
    src={stage === "display" ? imageOptimizationSrc(props.src) : props.src}
    alt={props.alt}
    fill
    quality={75}
    unoptimized={stage !== "display" || !canOptimizeImage(props.src)}
  />
);

export function ManagedImage({
  soldOut = false,
  progressive = true,
  sizes = "96px",
  ...props
}: ManagedImageProps & { soldOut?: boolean }) {
  const optimized = Boolean(props.src && canOptimizeImage(props.src));
  return (
    <ManagedImageFrame
      {...props}
      overlay={
        soldOut ? (
          <span
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/30"
            role="img"
            aria-label="已售罄"
          >
            <Image
              src={soldOutImage}
              width={256}
              height={256}
              alt=""
              aria-hidden="true"
              unoptimized
              className="h-auto max-h-[75%] w-[65%] max-w-32 object-contain opacity-80"
            />
          </span>
        ) : (
          props.overlay
        )
      }
      sizes={sizes}
      thumbnailSrc={
        optimized && progressive ? imageThumbnailSrc(props.src!) : undefined
      }
      cacheKey={optimized ? imageDisplayCacheKey(props.src!, sizes) : undefined}
      fallbackToOriginal={optimized}
      renderImage={renderImage}
    />
  );
}
