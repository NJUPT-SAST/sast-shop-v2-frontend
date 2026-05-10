"use client"

import { usePresign } from "@/lib/api/queries"
import type { PresignPurpose } from "@/lib/api/types"
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Icon } from "@iconify/react"
import imageCompression from "browser-image-compression"
import { useEffect, useId, useRef, useState } from "react"

type PendingStatus = "queued" | "uploading" | "error"
type PendingItem = {
  id: string
  file: File
  status: PendingStatus
  error?: string
}

async function putToPresignedUrl(
  url: string,
  method: "PUT" | "POST",
  headers: Record<string, string>,
  blob: Blob
): Promise<void> {
  const res = await fetch(url, { method, headers, body: blob })
  if (!res.ok) {
    throw new Error(`上传失败 (HTTP ${res.status})`)
  }
}

export type ImageUploadVariant = "grid" | "hero"

export function ImageUpload({
  value,
  onChange,
  purpose = "listing_image",
  max = 9,
  label,
  hint,
  variant = "grid",
  enableSort,
  showCover,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  purpose?: PresignPurpose
  max?: number
  label?: string
  hint?: string
  /** "grid"（默认 9 宫格）或 "hero"（首图大、其余缩略图，闲鱼/小红书风） */
  variant?: ImageUploadVariant
  /** 启用拖拽排序，默认在 max>1 时开启 */
  enableSort?: boolean
  /** 首图标记「封面」角标，默认在 max>1 时开启 */
  showCover?: boolean
}) {
  const inputId = useId()
  const presign = usePresign()
  const [pending, setPending] = useState<PendingItem[]>([])
  const drainingRef = useRef(false)
  const queueRef = useRef<PendingItem[]>([])
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const sortEnabled = enableSort ?? max > 1
  const coverEnabled = showCover ?? max > 1
  const remaining = Math.max(0, max - value.length - pending.length)

  // === 上传队列 ===
  async function uploadOne(item: PendingItem) {
    setPending((p) =>
      p.map((x) => (x.id === item.id ? { ...x, status: "uploading", error: undefined } : x))
    )
    try {
      const compressed = await imageCompression(item.file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: item.file.type as "image/jpeg" | "image/png" | "image/webp",
      })
      const presigned = await presign.mutateAsync({
        filename: item.file.name,
        content_type: compressed.type || "image/jpeg",
        size_bytes: compressed.size,
        purpose,
      })
      await putToPresignedUrl(
        presigned.upload_url,
        presigned.method,
        presigned.headers ?? {},
        compressed
      )
      onChange([...valueRef.current, presigned.public_url])
      setPending((p) => p.filter((x) => x.id !== item.id))
    } catch (err) {
      console.error(err)
      setPending((p) =>
        p.map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: "error",
                error: err instanceof Error ? err.message : "上传失败，请稍后重试",
              }
            : x
        )
      )
    }
  }

  async function drainQueue() {
    if (drainingRef.current) return
    drainingRef.current = true
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift()
        if (next) await uploadOne(next)
      }
    } finally {
      drainingRef.current = false
    }
  }

  function enqueue(files: FileList | File[]) {
    const list = Array.from(files).slice(0, remaining)
    if (list.length === 0) return
    const items: PendingItem[] = list.map((file) => ({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      file,
      status: "queued",
    }))
    setPending((p) => [...p, ...items])
    queueRef.current.push(...items)
    void drainQueue()
  }

  function retry(id: string) {
    const item = pending.find((p) => p.id === id)
    if (!item) return
    queueRef.current.push(item)
    void drainQueue()
  }

  function removePending(id: string) {
    queueRef.current = queueRef.current.filter((x) => x.id !== id)
    setPending((p) => p.filter((x) => x.id !== id))
  }

  function removeUploaded(index: number) {
    const next = [...value]
    next.splice(index, 1)
    onChange(next)
  }

  // === DnD sensors ===
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = value.findIndex((u) => u === active.id)
    const newIdx = value.findIndex((u) => u === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    onChange(arrayMove(value, oldIdx, newIdx))
  }

  // ============ Render ============
  const trigger =
    remaining > 0 ? (
      <Trigger htmlFor={inputId} busy={pending.some((p) => p.status === "uploading")} />
    ) : null

  const fileInput = (
    <input
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      disabled={remaining === 0}
      id={inputId}
      multiple={max > 1}
      onChange={(e) => {
        enqueue(e.target.files ?? [])
        e.target.value = ""
      }}
      type="file"
    />
  )

  const uploadedItems = value.map((url, i) =>
    sortEnabled ? (
      <SortableThumb
        coverLabel={coverEnabled && i === 0 ? "封面" : null}
        key={url}
        onRemove={() => removeUploaded(i)}
        url={url}
      />
    ) : (
      <Thumb
        coverLabel={coverEnabled && i === 0 ? "封面" : null}
        // biome-ignore lint/suspicious/noArrayIndexKey: stable index in non-sortable single-image case (max=1).
        key={`${url}-${i}`}
        onRemove={() => removeUploaded(i)}
        url={url}
      />
    )
  )

  const pendingItems = pending.map((p) => (
    <PendingThumb
      item={p}
      key={p.id}
      onCancel={() => removePending(p.id)}
      onRetry={() => retry(p.id)}
    />
  ))

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-medium text-shop-text-primary">{label}</span> : null}

      {variant === "hero" && max > 1 ? (
        <HeroLayout
          hasUploaded={value.length > 0}
          uploadedItems={uploadedItems}
          pendingItems={pendingItems}
          trigger={trigger}
          sortEnabled={sortEnabled}
          sortIds={value}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        />
      ) : (
        <GridLayout
          uploadedItems={uploadedItems}
          pendingItems={pendingItems}
          trigger={trigger}
          sortEnabled={sortEnabled}
          sortIds={value}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          single={max === 1}
        />
      )}

      {fileInput}

      {hint ? <p className="text-xs text-shop-text-tertiary">{hint}</p> : null}
    </div>
  )
}

// ===================================================================
// Layouts
// ===================================================================

function GridLayout({
  uploadedItems,
  pendingItems,
  trigger,
  sortEnabled,
  sortIds,
  sensors,
  onDragEnd,
  single,
}: {
  uploadedItems: React.ReactNode[]
  pendingItems: React.ReactNode[]
  trigger: React.ReactNode
  sortEnabled: boolean
  sortIds: string[]
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (e: DragEndEvent) => void
  single: boolean
}) {
  const gridCls = single
    ? "w-[160px] sm:w-[180px]"
    : "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
  const body = (
    <div className={gridCls}>
      {uploadedItems}
      {pendingItems}
      {trigger}
    </div>
  )
  if (!sortEnabled) return body
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
      <SortableContext items={sortIds} strategy={rectSortingStrategy}>
        {body}
      </SortableContext>
    </DndContext>
  )
}

function HeroLayout({
  hasUploaded,
  uploadedItems,
  pendingItems,
  trigger,
  sortEnabled,
  sortIds,
  sensors,
  onDragEnd,
}: {
  hasUploaded: boolean
  uploadedItems: React.ReactNode[]
  pendingItems: React.ReactNode[]
  trigger: React.ReactNode
  sortEnabled: boolean
  sortIds: string[]
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (e: DragEndEvent) => void
}) {
  if (!hasUploaded && pendingItems.length === 0) {
    return (
      <label
        className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-shop-lg border-2 border-dashed border-shop-border bg-shop-bg-tinted text-shop-text-tertiary transition hover:border-shop-primary hover:bg-shop-primary-wash hover:text-shop-primary"
        htmlFor={(trigger as React.ReactElement<{ htmlFor: string }>).props.htmlFor}
      >
        <Icon className="size-12" icon="material-symbols:add-photo-alternate-outline" />
        <span className="text-sm font-medium">点这里添加商品图</span>
        <span className="text-[12px] text-shop-text-tertiary">第一张为封面 · 最多 9 张</span>
      </label>
    )
  }

  const cover = uploadedItems[0]
  const restUploaded = uploadedItems.slice(1)

  const coverLarge = (
    <div className="aspect-[4/3] overflow-hidden rounded-shop-lg [&>div]:size-full [&>div]:rounded-shop-lg">
      {cover}
    </div>
  )

  const strip = (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {restUploaded.map((node, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: order managed by parent state.
        <div className="size-20 shrink-0" key={i}>
          {node}
        </div>
      ))}
      {pendingItems.map((node, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pending items have stable ids inside.
        <div className="size-20 shrink-0" key={`p-${i}`}>
          {node}
        </div>
      ))}
      {trigger ? <div className="size-20 shrink-0">{trigger}</div> : null}
    </div>
  )

  if (!sortEnabled) {
    return (
      <div className="flex flex-col gap-2">
        {coverLarge}
        {strip}
      </div>
    )
  }
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
      <SortableContext items={sortIds} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-2">
          {coverLarge}
          {strip}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ===================================================================
// Items
// ===================================================================

function Thumb({
  url,
  coverLabel,
  onRemove,
}: {
  url: string
  coverLabel: string | null
  onRemove: () => void
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-shop-md border border-shop-border-light bg-shop-bg-white">
      <img alt="" className="size-full object-cover" src={url} />
      {coverLabel ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-shop-primary px-2 py-0.5 text-[10px] font-medium text-shop-text-on-primary shadow-shop-sm">
          {coverLabel}
        </span>
      ) : null}
      <button
        aria-label="移除"
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
        onClick={onRemove}
        type="button"
      >
        <Icon className="size-4" icon="material-symbols:close-rounded" />
      </button>
    </div>
  )
}

function SortableThumb(props: { url: string; coverLabel: string | null; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.url,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="touch-none"
      {...attributes}
      {...listeners}
    >
      <Thumb {...props} />
    </div>
  )
}

function PendingThumb({
  item,
  onCancel,
  onRetry,
}: {
  item: PendingItem
  onCancel: () => void
  onRetry: () => void
}) {
  const isError = item.status === "error"
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-shop-md border ${
        isError
          ? "border-shop-danger bg-shop-danger-soft"
          : "border-shop-border-light bg-shop-bg-tinted"
      }`}
    >
      <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
        {isError ? (
          <>
            <Icon className="size-6 text-shop-danger" icon="material-symbols:error-outline" />
            <span className="line-clamp-2 text-[10px] text-shop-danger">{item.error}</span>
            <button
              aria-label="重试上传"
              className="mt-0.5 rounded-shop-sm bg-shop-danger px-2 py-0.5 text-[11px] font-medium text-white"
              onClick={onRetry}
              type="button"
            >
              重试
            </button>
          </>
        ) : (
          <>
            <Icon
              className="size-6 animate-spin text-shop-primary"
              icon="material-symbols:progress-activity"
            />
            <span className="text-[10px] text-shop-text-tertiary">上传中…</span>
          </>
        )}
      </div>
      <button
        aria-label="取消"
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
        onClick={onCancel}
        type="button"
      >
        <Icon className="size-4" icon="material-symbols:close-rounded" />
      </button>
    </div>
  )
}

function Trigger({ htmlFor, busy }: { htmlFor: string; busy: boolean }) {
  // Empty-state hero dropzone is rendered separately by HeroLayout; this is the small "+" tile.
  return (
    <label
      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-shop-md border-2 border-dashed border-shop-border bg-shop-bg-white text-shop-text-tertiary transition hover:border-shop-primary hover:text-shop-primary"
      htmlFor={htmlFor}
    >
      <Icon className="size-6" icon="material-symbols:add-photo-alternate-outline" />
      <span className="text-xs">{busy ? "上传中…" : "添加图片"}</span>
    </label>
  )
}
