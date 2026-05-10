"use client"

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
              <button
                aria-label="查看大图"
                className={`block w-full bg-shop-bg-tinted ${ASPECT_CLASS[aspect]}`}
                onClick={() => setLightboxOpen(true)}
                type="button"
              >
                <img
                  alt={`${alt} ${i + 1}`}
                  className="size-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  src={src}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 ? (
        withThumbnails ? (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                aria-label={`第 ${i + 1} 张`}
                className={`size-16 shrink-0 overflow-hidden rounded-shop-sm border-2 transition ${
                  selected === i ? "border-shop-primary" : "border-transparent"
                }`}
                key={src}
                onClick={() => scrollTo(i)}
                type="button"
              >
                <img alt="" className="size-full object-cover" src={src} />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex justify-center gap-1">
            {images.map((src, i) => (
              <button
                aria-label={`第 ${i + 1} 张`}
                className={`size-1.5 rounded-full transition ${
                  selected === i ? "w-6 bg-shop-primary" : "bg-shop-border-strong"
                }`}
                key={src}
                onClick={() => scrollTo(i)}
                type="button"
              />
            ))}
          </div>
        )
      ) : null}
      <button
        aria-label="放大查看"
        className="mt-2 inline-flex items-center gap-1 text-[12px] text-shop-text-tertiary transition hover:text-shop-primary"
        onClick={() => setLightboxOpen(true)}
        type="button"
      >
        <Icon className="size-4" icon="material-symbols:zoom-out-map-rounded" />
        放大查看
      </button>
      <MediaLightbox
        images={images}
        initialIndex={selected}
        onClose={() => setLightboxOpen(false)}
        open={lightboxOpen}
      />
    </div>
  )
}
