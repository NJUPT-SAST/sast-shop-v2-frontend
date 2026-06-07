"use client"

import { Button, CloseButton } from "@heroui/react"
import { Icon } from "@iconify/react"
import { AnimatePresence, m } from "motion/react"
import { useEffect, useRef, useState } from "react"

type Props = {
  open: boolean
  images: string[]
  initialIndex?: number
  onClose: () => void
}

// Two-finger pinch + double-tap to zoom on touch; Esc + arrows on keyboard.
// Backdrop click closes.
export function MediaLightbox({ open, images, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinchDist = useRef<number | null>(null)
  const lastTap = useRef(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset zoom/index whenever the lightbox opens fresh.
  useEffect(() => {
    setIndex(initialIndex)
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [initialIndex, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1))
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, images.length, onClose])

  // Lock scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  function pointerDistance() {
    const pts = Array.from(pointers.current.values())
    if (pts.length < 2) return 0
    const dx = pts[0].x - pts[1].x
    const dy = pts[0].y - pts[1].y
    return Math.hypot(dx, dy)
  }

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      lastPinchDist.current = pointerDistance()
    }
    if (pointers.current.size === 1) {
      const now = Date.now()
      if (now - lastTap.current < 280) {
        // Double-tap toggles zoom.
        setScale((s) => (s > 1 ? 1 : 2))
        setTranslate({ x: 0, y: 0 })
      }
      lastTap.current = now
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && lastPinchDist.current) {
      const next = pointerDistance()
      const ratio = next / lastPinchDist.current
      setScale((s) => Math.max(1, Math.min(4, s * ratio)))
      lastPinchDist.current = next
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) lastPinchDist.current = null
  }

  function reset() {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          animate={{ opacity: 1 }}
          aria-modal
          className="fixed inset-0 z-[60] flex flex-col bg-black/90"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          role="dialog"
        >
          <header className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-[13px] tabular-nums">
              {index + 1} / {images.length}
            </span>
            <CloseButton aria-label="关闭" className="!text-white" onPress={onClose} />
          </header>
          <div
            className="relative flex flex-1 select-none items-center justify-center overflow-hidden touch-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose()
            }}
            onPointerCancel={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerLeave={onPointerUp}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {images[index] ? (
              <img
                alt=""
                className="max-h-full max-w-full object-contain"
                draggable={false}
                src={images[index]}
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                  transition: pointers.current.size === 0 ? "transform 0.2s ease" : "none",
                }}
              />
            ) : null}
            {index > 0 ? (
              <Button
                aria-label="上一张"
                className="absolute left-2 top-1/2 -translate-y-1/2 !rounded-full !bg-white/10 !text-white backdrop-blur hover:!bg-white/20"
                isIconOnly
                onPress={() => {
                  setIndex(index - 1)
                  reset()
                }}
                variant="ghost"
              >
                <Icon className="size-6" icon="material-symbols:chevron-left-rounded" />
              </Button>
            ) : null}
            {index < images.length - 1 ? (
              <Button
                aria-label="下一张"
                className="absolute right-2 top-1/2 -translate-y-1/2 !rounded-full !bg-white/10 !text-white backdrop-blur hover:!bg-white/20"
                isIconOnly
                onPress={() => {
                  setIndex(index + 1)
                  reset()
                }}
                variant="ghost"
              >
                <Icon className="size-6" icon="material-symbols:chevron-right-rounded" />
              </Button>
            ) : null}
          </div>
          {images.length > 1 ? (
            <footer className="flex justify-center gap-1 p-3">
              {images.map((src, i) => (
                <Button
                  aria-label={`查看第 ${i + 1} 张`}
                  className={`!h-1.5 !min-h-0 !min-w-0 !rounded-full !p-0 transition ${
                    i === index ? "!w-6 !bg-white" : "!w-1.5 !bg-white/40"
                  }`}
                  key={src}
                  onPress={() => {
                    setIndex(i)
                    reset()
                  }}
                  variant="ghost"
                />
              ))}
            </footer>
          ) : null}
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
