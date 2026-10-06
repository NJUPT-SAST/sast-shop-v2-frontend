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
    if (!files) return;
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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || photos.length >= maxPhotos}
          onClick={() => camera.current?.click()}
        >
          <RiCameraLine data-icon="inline-start" />
          {face ? "拍摄本人照片" : "拍摄合照"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || photos.length >= maxPhotos}
          onClick={() => album.current?.click()}
        >
          <RiImageLine data-icon="inline-start" />
          从相册选择
        </Button>
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
            <div key={photo.id} className="relative">
              <ManagedImage
                src={photo.previewUrl}
                alt={`待上传照片 ${index + 1}`}
                className="aspect-square rounded-lg"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-1 top-1 size-11"
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
