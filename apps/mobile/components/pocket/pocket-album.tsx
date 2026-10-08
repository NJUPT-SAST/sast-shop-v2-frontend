"use client";

import { useEffect, useRef, useState } from "react";
import { RiImageLine, RiRefreshLine } from "@remixicon/react";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Spinner } from "@workspace/ui/components/spinner";
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
  const activePocketId = useRef<string | null>(null);
  useEffect(() => {
    activePocketId.current = pocketId;
    return () => {
      activePocketId.current = null;
    };
  }, [pocketId]);
  const [accepted, setAccepted] = useState(initiallyAccepted);
  const [loading, setLoading] = useState<"first" | "more" | null>(null);
  const [retryPage, setRetryPage] = useState<"first" | "more" | null>(null);
  const [photos, setPhotos] = useState<PocketPhoto[] | null>(null);
  const [nextPageToken, setNextPageToken] = useState("");
  const ownerOnly = isOwner && !ownerParticipates;
  const loadAlbum = async () => {
    setLoading("first");
    setRetryPage(null);
    try {
      const result = await listPocketAlbum({ pocketId }, options);
      if (activePocketId.current !== pocketId) return;
      setPhotos(result.photos);
      setNextPageToken(result.nextPageToken);
    } catch (reason) {
      if (activePocketId.current === pocketId) setRetryPage("first");
      throw reason;
    } finally {
      if (activePocketId.current === pocketId) setLoading(null);
    }
  };
  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoading("more");
    setRetryPage(null);
    try {
      const result = await listPocketAlbum(
        { pocketId, pageToken: nextPageToken },
        options,
      );
      if (activePocketId.current !== pocketId) return;
      setPhotos((previous) => [...(previous ?? []), ...result.photos]);
      setNextPageToken(result.nextPageToken);
    } catch (reason) {
      if (activePocketId.current === pocketId) setRetryPage("more");
      throw reason;
    } finally {
      if (activePocketId.current === pocketId) setLoading(null);
    }
  };
  return (
    <Card className="min-w-0">
      <CardHeader className="gap-2 pb-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <CardTitle>聚餐合照</CardTitle>
          {photos !== null ? (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 shrink-0"
              disabled={action.busy}
              onClick={() =>
                void action.run(`album:${pocketId}:load`, loadAlbum)
              }
            >
              {loading === "first" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RiRefreshLine data-icon="inline-start" />
              )}
              刷新合照
            </Button>
          ) : null}
        </div>
        <CardDescription className="leading-6">
          成员全部同意后开放，选择不影响付款
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" aria-busy={action.busy}>
        <PocketError
          message={action.error}
          retry={
            retryPage
              ? () =>
                  void action.run(
                    `album:${pocketId}:retry:${retryPage}`,
                    retryPage === "more" ? loadMore : loadAlbum,
                  )
              : undefined
          }
        />
        {!accepted && !ownerOnly ? (
          <Button
            className="min-h-11 w-full"
            disabled={action.busy}
            onClick={() =>
              void action.run(`album:${pocketId}:accept`, async (requestId) => {
                setRetryPage(null);
                await setPocketAlbumAccess(
                  { pocketId, accepted: true, requestId },
                  options,
                );
                if (activePocketId.current !== pocketId) return;
                setAccepted(true);
                await loadAlbum();
              })
            }
          >
            {action.busy ? <Spinner data-icon="inline-start" /> : null}
            同意并查看合照
          </Button>
        ) : photos === null ? (
          <Button
            variant="outline"
            className="min-h-11 w-full"
            disabled={action.busy}
            onClick={() => void action.run(`album:${pocketId}:load`, loadAlbum)}
          >
            {loading === "first" ? <Spinner data-icon="inline-start" /> : null}
            {ownerOnly ? "查看我上传的合照" : "查看合照"}
          </Button>
        ) : null}
        {loading === "first" && photos === null ? (
          <div role="status" aria-label="正在加载合照">
            <Skeleton className="aspect-[4/3] rounded-lg" />
          </div>
        ) : null}
        {photos?.length === 0 ? (
          <Empty
            icon={<RiImageLine className="size-6" />}
            title="暂无可查看的合照"
            className="min-h-32 py-5"
          />
        ) : photos ? (
          <div className="flex flex-col gap-3">
            {photos.map((photo, index) => (
              <figure key={photo.id} className="min-w-0">
                <a
                  href={photo.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`查看聚餐合照 ${index + 1}（新窗口）`}
                  className="block rounded-lg outline-none transition-opacity active:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  <ManagedImage
                    src={photo.previewUrl}
                    sizes="(max-width: 640px) calc((100vw - 48px) / 2), 288px"
                    alt={`聚餐留念 ${index + 1}`}
                    className="aspect-[4/3] rounded-lg"
                    imageClassName="object-contain"
                  />
                </a>
                {photo.retentionUntil || isOwner ? (
                  <figcaption className="flex min-h-11 items-center justify-between gap-3">
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
                        variant="destructive-text"
                        className="min-h-11 shrink-0"
                        disabled={action.busy}
                        onClick={() => setDeletingPhoto(photo.id)}
                      >
                        删除照片
                      </Button>
                    ) : null}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : null}
        {photos && nextPageToken ? (
          <Button
            variant="outline"
            className="min-h-11 w-full"
            disabled={action.busy}
            onClick={() =>
              void action.run(`album-more:${nextPageToken}`, loadMore)
            }
          >
            {loading === "more" ? <Spinner data-icon="inline-start" /> : null}
            更多合照
          </Button>
        ) : null}
      </CardContent>
      {accepted ? (
        <CardFooter className="border-t border-border/70 p-3">
          <Button
            variant="ghost"
            className="min-h-11 w-full"
            disabled={action.busy}
            onClick={() =>
              void action.run(`album:${pocketId}:revoke`, async (requestId) => {
                setRetryPage(null);
                await setPocketAlbumAccess(
                  { pocketId, accepted: false, requestId },
                  options,
                );
                if (activePocketId.current !== pocketId) return;
                setAccepted(false);
                setPhotos(null);
                setNextPageToken("");
              })
            }
          >
            撤回相册访问同意
          </Button>
        </CardFooter>
      ) : null}
      {deletingPhoto ? (
        <PocketPhotoDeleteDialog
          pocketId={pocketId}
          photoId={deletingPhoto}
          onClose={() => setDeletingPhoto(null)}
          onDeleted={() => {
            if (activePocketId.current !== pocketId) return;
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
