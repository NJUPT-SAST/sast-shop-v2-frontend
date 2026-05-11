"use client"

import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import useEmblaCarousel from "embla-carousel-react"
import { useCallback, useEffect, useState } from "react"
import { MediaLightbox } from "./media-lightbox"

type Props = {
  images: string[]
  alt: string
  /** Render with thumbnail strip below; otherwise dot indicators. */
  withThumbnails?: boolean
  className?: string
  aspect?: "square" | "wide" | "portrait"
}

const ASPECT_CLASS: Record<NonNullable<Props["aspect"]>, string> = {
  square: "aspect-square",
  wide: "aspect-[5/3]",
  portrait: "aspect-[3/4]",
}

export function MediaGallery({
  images,
  alt,
  withThumbnails = true,
  className,
  aspect = "square",
}: Props) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, align: "start" })
  const [selected, setSelected] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const onSelect = useCallback(() => {
    if (!embla) return
    setSelected(embla.selectedScrollSnap())
  }, [embla])

  useEffect(() => {
    if (!embla) return
    onSelect()
    embla.on("select", onSelect)
    embla.on("reInit", onSelect)
  }, [embla, onSelect])

  function scrollTo(i: number) {
    embla?.scrollTo(i)
  }

  if (images.length === 0) {
    return (
      <div
        className={`shop-card__media ${ASPECT_CLASS[aspect]} flex items-center justify-center text-shop-text-tertiary ${className ?? ""}`}
      >
        暂无图片
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((src, i) => (
            <div className="relative w-full shrink-0 grow-0 basis-full" key={src}>
              <Button
                aria-label="查看大图"
                className={`!h-auto !min-h-0 !min-w-0 !w-full !rounded-none !bg-shop-bg-tinted !p-0 ${ASPECT_CLASS[aspect]}`}
                onPress={() => setLightboxOpen(true)}
                variant="ghost"
              >
                <img
                  alt={`${alt} ${i + 1}`}
                  className="size-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  src={src}
                />
              </Button>
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 ? (
        withThumbnails ? (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <Button
                aria-label={`第 ${i + 1} 张`}
                className={`!size-16 shrink-0 !min-w-0 overflow-hidden !rounded-shop-sm !border-2 !p-0 transition ${
                  selected === i ? "!border-shop-primary" : "!border-transparent"
                }`}
                key={src}
                onPress={() => scrollTo(i)}
                variant="ghost"
              >
                <img alt="" className="size-full object-cover" src={src} />
              </Button>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex justify-center gap-1">
            {images.map((src, i) => (
              <Button
                aria-label={`第 ${i + 1} 张`}
                className={`!h-1.5 !min-h-0 !min-w-0 !rounded-full !p-0 transition ${
                  selected === i ? "!w-6 !bg-shop-primary" : "!w-1.5 !bg-shop-border-strong"
                }`}
                key={src}
                onPress={() => scrollTo(i)}
                variant="ghost"
              />
            ))}
          </div>
        )
      ) : null}
      <Button
        aria-label="放大查看"
        className="mt-2 !h-auto !min-h-0 !min-w-0 !gap-1 self-start !p-0 text-[12px] text-shop-text-tertiary hover:!text-shop-primary"
        onPress={() => setLightboxOpen(true)}
        size="sm"
        variant="ghost"
      >
        <Icon className="size-4" icon="material-symbols:zoom-out-map-rounded" />
        放大查看
      </Button>
      <MediaLightbox
        images={images}
        initialIndex={selected}
        onClose={() => setLightboxOpen(false)}
        open={lightboxOpen}
      />
    </div>
  )
}
