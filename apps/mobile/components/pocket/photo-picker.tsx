"use client";
import { useEffect, useRef, useState } from "react";
import { RiCameraLine, RiImageLine, RiDeleteBinLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { ManagedImage } from "../managed-image";
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
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="min-w-0 whitespace-normal"
          disabled={disabled || photos.length >= maxPhotos}
          onClick={() => camera.current?.click()}
        >
          <RiCameraLine data-icon="inline-start" />
          {face ? "拍摄本人照片" : "拍摄合照"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="min-w-0 whitespace-normal"
          disabled={disabled || photos.length >= maxPhotos}
          onClick={() => album.current?.click()}
        >
          <RiImageLine data-icon="inline-start" />
          从相册选择
        </Button>
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
      {photos.length ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative min-w-0">
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
                className="absolute right-1 top-1"
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
        </div>
      ) : null}
    </div>
  );
}
