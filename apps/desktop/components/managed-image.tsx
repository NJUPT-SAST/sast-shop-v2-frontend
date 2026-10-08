"use client";

import Image from "next/image";
import {
  ManagedImageFrame,
  type ManagedImageProps,
  type ManagedImageRenderer,
} from "@workspace/ui/components/managed-image";
import {
  canOptimizeImage,
  imageDisplayCacheKey,
  imageThumbnailSrc,
} from "@workspace/ui/lib/image-variants";

const renderImage: ManagedImageRenderer = ({ stage, ...props }) => (
  <Image
    {...props}
    alt={props.alt}
    fill
    quality={75}
    unoptimized={stage !== "display" || !canOptimizeImage(props.src)}
  />
);

export function ManagedImage({
  progressive = true,
  sizes = "96px",
  ...props
}: ManagedImageProps) {
  const optimized = Boolean(props.src && canOptimizeImage(props.src));
  return (
    <ManagedImageFrame
      {...props}
      sizes={sizes}
      thumbnailSrc={
        optimized && progressive ? imageThumbnailSrc(props.src!) : undefined
      }
      cacheKey={optimized ? imageDisplayCacheKey(props.src!, sizes) : undefined}
      renderImage={renderImage}
    />
  );
}
