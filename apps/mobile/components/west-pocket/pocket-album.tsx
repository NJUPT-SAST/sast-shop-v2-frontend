"use client";
import { useState } from "react";
import {
  deletePocketPhoto,
  listPocketAlbum,
  setPocketAlbumAccess,
  type PocketPhoto,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { ManagedImage } from "../managed-image";
import { PocketError, usePocketAction, usePocketOptions } from "./shared";

export function PocketAlbum({
  pocketId,
  isOwner,
  ownerParticipates,
  initiallyAccepted,
}: {
  pocketId: string;
  isOwner: boolean;
  ownerParticipates: boolean;
  initiallyAccepted: boolean;
}) {
  const options = usePocketOptions();
  const action = usePocketAction();
  const [accepted, setAccepted] = useState(initiallyAccepted);
  const [photos, setPhotos] = useState<PocketPhoto[] | null>(null);
  const [nextPageToken, setNextPageToken] = useState("");
  const ownerOnly = isOwner && !ownerParticipates;
  const loadAlbum = async () => {
    const result = await listPocketAlbum({ pocketId }, options);
    setPhotos(result.photos);
    setNextPageToken(result.nextPageToken);
  };
  return (
    <section className="space-y-3 border-t pt-5">
      <h2 className="font-semibold">聚餐合照</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        合照需所有分摊成员同意后，才向成员开放。发起人可管理自己上传的照片。你的选择不影响付款。
      </p>
      <PocketError message={action.error} />
      {!accepted && !ownerOnly ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={action.busy}
          onClick={() =>
            void action.run(`album:${pocketId}:accept`, async (requestId) => {
              await setPocketAlbumAccess(
                { pocketId, accepted: true, requestId },
                options,
              );
              setAccepted(true);
              await loadAlbum();
            })
          }
        >
          同意并查看合照
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          disabled={action.busy}
          onClick={() => void action.run(`album:${pocketId}:load`, loadAlbum)}
        >
          {photos === null
            ? ownerOnly
              ? "查看我上传的合照"
              : "查看合照"
            : "刷新合照"}
        </Button>
      )}
      {photos?.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          暂无可查看的留念合照，照片可能已到保存期限。
        </p>
      ) : photos ? (
        <div className="space-y-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="space-y-2">
              <a
                href={photo.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ManagedImage
                  src={photo.previewUrl}
                  alt={`聚餐留念 ${index + 1}`}
                  className="aspect-[4/3] rounded-lg"
                />
              </a>
              {photo.retentionUntil ? (
                <p className="text-xs text-muted-foreground">
                  保留至{" "}
                  {new Date(photo.retentionUntil).toLocaleDateString("zh-CN")}
                </p>
              ) : null}
              {isOwner ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(`delete:${photo.id}`, async (requestId) => {
                      await deletePocketPhoto(
                        { pocketId, photoId: photo.id, requestId },
                        options,
                      );
                      setPhotos(photos.filter((item) => item.id !== photo.id));
                    })
                  }
                >
                  删除这张合照
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {photos && nextPageToken ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={action.busy}
          onClick={() =>
            void action.run(`album-more:${nextPageToken}`, async () => {
              const result = await listPocketAlbum(
                { pocketId, pageToken: nextPageToken },
                options,
              );
              setPhotos([...photos, ...result.photos]);
              setNextPageToken(result.nextPageToken);
            })
          }
        >
          更多合照
        </Button>
      ) : null}
      {accepted ? (
        <Button
          variant="ghost"
          className="w-full"
          disabled={action.busy}
          onClick={() =>
            void action.run(`album:${pocketId}:revoke`, async (requestId) => {
              await setPocketAlbumAccess(
                { pocketId, accepted: false, requestId },
                options,
              );
              setAccepted(false);
              setPhotos(null);
              setNextPageToken("");
            })
          }
        >
          撤回相册访问同意
        </Button>
      ) : null}
    </section>
  );
}
