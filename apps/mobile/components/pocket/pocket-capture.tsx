"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addPocketPhotos,
  getPocket,
  getPocketCapabilities,
  getPocketJob,
  retryPocketJob,
  startPocketRecognition,
  type PocketJob,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  pocketJobFinished,
  pocketMoney,
  pocketStatusLabel,
} from "@/lib/pocket";
import { uploadPocketPhoto, type PocketUpload } from "@/lib/pocket-upload";
import { PocketPhotoDeleteDialog } from "./photo-delete-dialog";
import { ManagedImage } from "../managed-image";
import { PocketMembersDrawer } from "./members-drawer";
import { PocketPhotoPicker, type SelectedPocketPhoto } from "./photo-picker";
import {
  PocketConsent,
  PocketError,
  PocketHeading,
  PocketJobProgress,
  PocketLoading,
  usePocketAction,
  usePocketOptions,
  usePocketPolling,
  usePocketResource,
} from "./shared";

export function PocketCapture({ pocketId }: { pocketId: string }) {
  const options = usePocketOptions();
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const detail = usePocketResource(
    useCallback(() => getPocket(pocketId, options), [pocketId, options]),
  );
  const capabilities = usePocketResource(
    useCallback(() => getPocketCapabilities(options), [options]),
  );
  const [photos, setPhotos] = useState<SelectedPocketPhoto[]>([]);
  const [consented, setConsented] = useState(false);
  const [album, setAlbum] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [job, setJob] = useState<PocketJob | null>(null);
  const [progress, setProgress] = useState("");
  const uploads = useRef(new Map<string, PocketUpload>());
  const action = usePocketAction({
    reconcile: async () => Boolean(await detail.refreshFresh()),
  });
  const refreshDetail = detail.refresh;
  const completed = useCallback(() => {
    refreshDetail();
    setMembersOpen(true);
  }, [refreshDetail]);
  const current = detail.data?.pocket.id === pocketId ? detail.data : null;
  if (!current)
    return (
      <div className="space-y-4 py-6">
        <PocketHeading title="合照选人" />
        <PocketError
          message={detail.error}
          retry={action.pending ? action.recover : detail.refresh}
        />
        {!detail.error ? <PocketLoading /> : null}
      </div>
    );
  if (!current.isOwner || current.pocket.status !== "draft")
    return (
      <div className="space-y-4 py-6">
        <PocketHeading title="合照选人" />
        <p className="text-sm text-muted-foreground">
          {current.isOwner
            ? `活动${pocketStatusLabel(current.pocket.status)}，名单已固定。`
            : "只有发起人可以上传合照和编辑名单。"}
        </p>
        <Button asChild variant="outline">
          <Link href={`/pocket/${pocketId}`}>查看活动</Link>
        </Button>
      </div>
    );
  const activeJob =
    (job && !pocketJobFinished(job.status) ? job : null) ??
    current.jobs.find(
      (item) => item.kind === "recognize" && !pocketJobFinished(item.status),
    ) ??
    job;
  const caps = capabilities.data;
  const canUpload = Boolean(
    caps?.photoUploadAvailable && caps.photoConsentVersion,
  );

  async function upload() {
    if (!caps || !current || !consented) return;
    await action.run(
      `upload:${photos.map((photo) => photo.id).join(",")}:${current.pocket.revision}:${album}`,
      async (requestId) => {
        const uploadIds: string[] = [];
        for (let index = 0; index < photos.length; index++) {
          const selected = photos[index]!;
          setProgress(`正在上传 ${index + 1} / ${photos.length} 张`);
          let uploaded = uploads.current.get(selected.id);
          if (!uploaded || Date.parse(uploaded.expiresAt) <= Date.now()) {
            uploaded = await uploadPocketPhoto(selected.file, {
              purpose: "group_photo",
              pocketId,
              consentVersion: caps.photoConsentVersion,
              requestId: uploaded ? crypto.randomUUID() : selected.id,
            });
            uploads.current.set(selected.id, uploaded);
          }
          uploadIds.push(uploaded.uploadId);
        }
        const result = await addPocketPhotos(
          {
            pocketId,
            uploadIds,
            retentionMode: album ? "keepsake" : "temporary",
            captureAuthorizationVersion: caps.photoConsentVersion,
            expectedRevision: current.pocket.revision,
            requestId,
          },
          options,
        );
        setPhotos([]);
        setProgress("照片已上传");
        detail.setData(await getPocket(pocketId, options));
        if (caps.faceRecognitionAvailable) {
          const recognition = await startPocketRecognition(
            {
              pocketId,
              photoIds: result.photos
                .filter(
                  (photo) =>
                    !current.photos.some(
                      (existing) => existing.id === photo.id,
                    ),
                )
                .map((photo) => photo.id),
              requestId,
            },
            options,
          );
          setJob(recognition);
        } else setMembersOpen(true);
      },
    );
  }
  return (
    <div className="space-y-4 py-4">
      <PocketHeading title="选择分摊人" />
      <section
        className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm"
        aria-label="聚餐信息"
      >
        <p className="min-w-0 break-words font-medium">
          {current.pocket.title || "Pocket"}
        </p>
        <p className="shrink-0 font-semibold tabular-nums text-primary">
          <span className="mr-2 font-normal text-muted-foreground">总金额</span>
          {pocketMoney(current.pocket.totalCents)}
        </p>
      </section>
      <PocketError
        message={detail.error || action.error}
        retry={action.pending ? action.recover : detail.refresh}
      />
      <Button
        variant={canUpload ? "outline" : "default"}
        size="lg"
        className="w-full"
        disabled={action.busy || Boolean(detail.error)}
        onClick={() => setMembersOpen(true)}
      >
        搜索姓名选人
      </Button>
      {!canUpload ? (
        <p className="rounded-lg bg-muted p-3 text-sm leading-6">
          {capabilities.error ||
            (caps ? "合照功能暂未开放" : "正在检查合照服务")}
        </p>
      ) : (
        <>
          <div className="space-y-2 border-t pt-4 text-sm leading-6">
            <h2 className="font-semibold">合照选人</h2>
            <p className="text-muted-foreground">
              合照存入私有存储，由腾讯云匹配已授权人脸，仅提供候选名单。上传前请征得入镜者同意，并裁剪或遮挡旁人
            </p>
            <PocketConsent
              checked={consented}
              onChange={setConsented}
              disabled={action.busy}
            >
              所有入镜者已知情同意，可用此合照识别选人
            </PocketConsent>
            <PocketConsent
              checked={album}
              onChange={setAlbum}
              disabled={action.busy}
            >
              另行保留为聚餐合照，仅向同意相册访问的成员开放
            </PocketConsent>
            <p className="text-xs text-muted-foreground">
              临时合照保留 24 小时，留念合照保留 30 天，到期自动清理
            </p>
          </div>
          <PocketPhotoPicker
            photos={photos}
            onChange={setPhotos}
            disabled={action.busy || !consented}
            maxPhotos={Math.max(
              0,
              (caps?.maxPhotos ?? 10) - current.photos.length,
            )}
          />
          <Button
            className="w-full"
            disabled={action.busy || !consented || !photos.length}
            onClick={() => void upload()}
          >
            {action.busy ? <Spinner /> : null}上传并
            {caps?.faceRecognitionAvailable ? "识别" : "手动选人"}
          </Button>
          {progress ? (
            <p
              role="status"
              className="text-center text-sm text-muted-foreground"
            >
              {progress}
            </p>
          ) : null}
        </>
      )}
      {activeJob ? (
        <RecognitionProgress
          jobId={activeJob.id}
          onCompleted={completed}
          onUpdate={setJob}
        />
      ) : null}
      {current.photos.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            已上传 {current.photos.length} 张
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {current.photos.map((photo, index) => (
              <div key={photo.id} className="space-y-2">
                <ManagedImage
                  src={photo.previewUrl}
                  alt={`聚餐合照 ${index + 1}`}
                  className="aspect-[4/3] rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  {photo.detectedFaceCount > 0
                    ? `检测到 ${photo.detectedFaceCount} 张人脸`
                    : "等待识别"}
                  {photo.errorCode ? " · 识别未完成，可补拍或手选" : ""}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={action.busy}
                  onClick={() => setDeletingPhoto(photo.id)}
                >
                  删除照片
                </Button>
              </div>
            ))}
          </div>
          {caps?.faceRecognitionAvailable ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={
                action.busy ||
                Boolean(activeJob && !pocketJobFinished(activeJob.status))
              }
              onClick={() =>
                void action.run(
                  `recognize:${current.photos.map((photo) => photo.id).join(",")}`,
                  async (requestId) => {
                    setJob(
                      await startPocketRecognition(
                        {
                          pocketId,
                          photoIds: current.photos.map((photo) => photo.id),
                          requestId,
                        },
                        options,
                      ),
                    );
                  },
                )
              }
            >
              重新识别已上传合照
            </Button>
          ) : null}
        </section>
      ) : null}
      {deletingPhoto ? (
        <PocketPhotoDeleteDialog
          pocketId={pocketId}
          photoId={deletingPhoto}
          onClose={() => setDeletingPhoto(null)}
          onDeleted={() => {
            void detail.refreshFresh();
          }}
        />
      ) : null}
      {membersOpen ? (
        <PocketMembersDrawer
          detail={current}
          onClose={() => setMembersOpen(false)}
          onChanged={detail.refresh}
        />
      ) : null}
    </div>
  );
}

function RecognitionProgress({
  jobId,
  onCompleted,
  onUpdate,
}: {
  jobId: string;
  onCompleted: () => void;
  onUpdate: (job: PocketJob) => void;
}) {
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getPocketJob(jobId, options), [jobId, options]),
  );
  const action = usePocketAction();
  const notified = useRef("");
  usePocketPolling(
    result.refresh,
    !result.data || !pocketJobFinished(result.data.status),
  );
  useEffect(() => {
    const updated = result.data;
    if (!updated) return;
    const timer = window.setTimeout(() => {
      onUpdate(updated);
      if (
        ["succeeded", "completed"].includes(updated.status) &&
        notified.current !== updated.id
      ) {
        notified.current = updated.id;
        onCompleted();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [result.data, onCompleted, onUpdate]);
  return (
    <div className="space-y-3">
      <PocketError
        message={result.error || action.error}
        retry={action.pending ? action.recover : result.refresh}
      />
      {result.data ? (
        <PocketJobProgress
          job={result.data}
          busy={action.busy}
          retry={() =>
            void action.run(`retry:${jobId}`, async (requestId) => {
              result.setData(
                await retryPocketJob({ jobId, requestId }, options),
              );
            })
          }
        />
      ) : (
        <PocketLoading />
      )}
    </div>
  );
}
