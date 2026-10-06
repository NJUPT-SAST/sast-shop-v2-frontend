"use client";
import { useState } from "react";
import {
  listPocketAlbum,
  setPocketAlbumAccess,
  type PocketPhoto,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { PocketPhotoDeleteDialog } from "./photo-delete-dialog";
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
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
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
    <Card>
      <CardHeader>
        <CardTitle>聚餐合照</CardTitle>
        <CardDescription className="leading-relaxed">
          成员全部同意后开放，选择不影响付款
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
          <p className="py-3 text-sm text-muted-foreground">暂无可查看的合照</p>
        ) : photos ? (
          <div className="flex flex-col gap-3">
            {photos.map((photo, index) => (
              <div key={photo.id} className="flex flex-col gap-1">
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
                {photo.retentionUntil || isOwner ? (
                  <div className="flex min-h-11 items-center justify-between gap-3">
                    {photo.retentionUntil ? (
                      <p className="text-xs text-muted-foreground">
                        保留至{" "}
                        {new Date(photo.retentionUntil).toLocaleDateString(
                          "zh-CN",
                        )}
                      </p>
                    ) : (
                      <span />
                    )}
                    {isOwner ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 shrink-0"
                        disabled={action.busy}
                        onClick={() => setDeletingPhoto(photo.id)}
                      >
                        删除照片
                      </Button>
                    ) : null}
                  </div>
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
      </CardContent>
      {deletingPhoto ? (
        <PocketPhotoDeleteDialog
          pocketId={pocketId}
          photoId={deletingPhoto}
          onClose={() => setDeletingPhoto(null)}
          onDeleted={() => {
            setPhotos(
              (previous) =>
                previous?.filter((photo) => photo.id !== deletingPhoto) ?? null,
            );
          }}
        />
      ) : null}
    </Card>
  );
}
