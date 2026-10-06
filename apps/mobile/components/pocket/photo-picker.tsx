"use client";
import { useEffect, useRef, useState } from "react";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { ManagedImage } from "../managed-image";
import { BrandIllustration } from "../brand-illustration";
import { pocketError, validatePocketImage } from "@/lib/pocket";
import { PocketError } from "./shared";

export interface SelectedPocketPhoto {
  id: string;
  file: File;
  previewUrl: string;
}
export function PocketPhotoPicker({
  photos,
  onChange,
  disabled,
  face,
  maxPhotos,
}: {
  photos: SelectedPocketPhoto[];
  onChange: (photos: SelectedPocketPhoto[]) => void;
  disabled?: boolean;
  face?: boolean;
  maxPhotos: number;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);
  useEffect(() => {
    const current = new Set(photos.map((photo) => photo.previewUrl));
    for (const url of objectUrls.current) {
      if (!current.has(url)) {
        URL.revokeObjectURL(url);
        objectUrls.current.delete(url);
      }
    }
  }, [photos]);
  function add(files: FileList | null) {
    if (disabled || !files) return;
    try {
      const selected = Array.from(files);
      if (!selected.length) return;
      if (selected.length + photos.length > maxPhotos)
        throw new Error(`最多选择 ${maxPhotos} 张照片`);
      selected.forEach(validatePocketImage);
      onChange([
        ...photos,
        ...selected.map((file) => {
          const previewUrl = URL.createObjectURL(file);
          objectUrls.current.add(previewUrl);
          return { id: crypto.randomUUID(), file, previewUrl };
        }),
      ]);
      setError("");
    } catch (reason) {
      setError(pocketError(reason));
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="app-scrollbar flex min-w-0 gap-2 overflow-x-auto py-1">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative size-24 shrink-0">
            <ManagedImage
              src={photo.previewUrl}
              alt={`待上传照片 ${index + 1}`}
              className="aspect-square rounded-lg"
              imageClassName={face ? "object-contain" : undefined}
            />
            <Button
              type="button"
              size="icon-xs"
              variant="secondary"
              className="absolute right-1 top-1 size-6"
              disabled={disabled}
              aria-label={`移除第 ${index + 1} 张照片`}
              onClick={() =>
                onChange(photos.filter((value) => value.id !== photo.id))
              }
            >
              <RiDeleteBinLine />
            </Button>
          </div>
        ))}
        {photos.length < maxPhotos ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-24 shrink-0 border-dashed bg-muted/30 md:size-24"
            disabled={disabled}
            aria-label="添加照片"
            aria-haspopup="dialog"
            onClick={() => setSourceOpen(true)}
          >
            <RiAddLine className="size-6" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
        <span>JPEG、PNG，每张不超过 10 MB</span>
        <span className="tabular-nums">
          已选 {photos.length} / {maxPhotos} 张
        </span>
      </div>
      <input
        ref={camera}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png"
        capture={face ? "user" : "environment"}
        disabled={disabled}
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={album}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png"
        multiple
        disabled={disabled}
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
      <PocketError message={error} />
      <Drawer open={sourceOpen} onOpenChange={setSourceOpen}>
        <DrawerContent className="overflow-clip">
          <DrawerHeader className="text-center">
            <DrawerTitle>添加照片</DrawerTitle>
            <DrawerDescription className="sr-only">
              选择拍照或从相册添加照片
            </DrawerDescription>
          </DrawerHeader>
          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="h-auto min-h-36 min-w-0 flex-col gap-2 whitespace-normal rounded-xl bg-card px-3 py-4 shadow-sm"
                disabled={disabled || photos.length >= maxPhotos}
                onClick={() => {
                  setSourceOpen(false);
                  camera.current?.click();
                }}
              >
                <BrandIllustration name="camera" size={48} />
                <span className="font-semibold">拍照</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="h-auto min-h-36 min-w-0 flex-col gap-2 whitespace-normal rounded-xl bg-card px-3 py-4 shadow-sm"
                disabled={disabled || photos.length >= maxPhotos}
                onClick={() => {
                  setSourceOpen(false);
                  album.current?.click();
                }}
              >
                <BrandIllustration name="photo-album" size={48} />
                <span className="font-semibold">从相册选择</span>
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
