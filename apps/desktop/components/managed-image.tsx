"use client";

import Image from "next/image";
import {
  ManagedImageFrame,
  type ManagedImageProps,
  type ManagedImageRenderer,
} from "@workspace/ui/components/managed-image";

const renderImage: ManagedImageRenderer = (props) => (
  <Image
    {...props}
    alt={props.alt}
    fill
    unoptimized
    sizes="(max-width: 1200px) 33vw, 280px"
  />
);

export function ManagedImage(props: ManagedImageProps) {
  return <ManagedImageFrame {...props} renderImage={renderImage} />;
}
