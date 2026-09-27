"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addPocketPhotos,
  deletePocketPhoto,
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
} from "@/lib/west-pocket";
import { uploadPocketPhoto, type PocketUpload } from "@/lib/west-pocket-upload";
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
  const action = usePocketAction();
  const refreshDetail = detail.refresh;
  const completed = useCallback(() => {
    refreshDetail();
    setMembersOpen(true);
  }, [refreshDetail]);
  const current = detail.data;
  if (!current)
    return (
      <div className="space-y-4 py-6">
        <PocketHeading title="合照选人" />
        <PocketError message={detail.error} retry={detail.refresh} />
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
          <Link href={`/west-pocket/${pocketId}`}>查看活动</Link>
        </Button>
      </div>
    );
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
          if (!uploaded) {
            uploaded = await uploadPocketPhoto(selected.file, {
              purpose: "group_photo",
              pocketId,
              consentVersion: caps.photoConsentVersion,
              requestId: selected.id,
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
    <div className="space-y-5 py-6">
      <PocketHeading
        title="拍一张合照"
        description={`${current.pocket.title || "聚餐 AA"} · 总金额 ${pocketMoney(current.pocket.totalCents)}`}
      />
      <PocketError
        message={detail.error || action.error}
        retry={detail.refresh}
      />
      {!canUpload ? (
        <p className="rounded-lg bg-muted p-3 text-sm leading-6">
          {capabilities.error ||
            (caps
              ? "合照上传暂未开放。可以先搜索姓名，照常发起 AA。"
              : "正在检查合照服务，姓名搜索随时可用。")}
        </p>
      ) : (
        <>
          <div className="space-y-2 text-sm leading-6">
            <p className="text-muted-foreground">
              合照将上传至私有存储，由腾讯云匹配已授权的人脸，只生成候选名单。请先征得所有入镜者同意；有旁人时先裁剪或遮挡。
            </p>
            <PocketConsent
              checked={consented}
              onChange={setConsented}
              disabled={action.busy}
            >
              我已告知并获得所有入镜者同意，本次照片可用于识别选人。
            </PocketConsent>
            <PocketConsent
              checked={album}
              onChange={setAlbum}
              disabled={action.busy}
            >
              另行保留为聚餐合照，供已同意相册访问的成员留念。
            </PocketConsent>
            <p className="text-xs text-muted-foreground">
              临时合照保留 24 小时，留念合照保留 30 天，到期自动清理。授权版本：
              {caps?.photoConsentVersion}
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
      {job ? (
        <RecognitionProgress
          jobId={job.id}
          onCompleted={completed}
          onUpdate={setJob}
        />
      ) : null}
      {current.photos.length ? (
        <section className="space-y-3">
          <h2 className="font-semibold">已上传 {current.photos.length} 张</h2>
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
                  onClick={() =>
                    void action.run(`delete:${photo.id}`, async (requestId) => {
                      await deletePocketPhoto(
                        { pocketId, photoId: photo.id, requestId },
                        options,
                      );
                      detail.refresh();
                    })
                  }
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
                action.busy || Boolean(job && !pocketJobFinished(job.status))
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
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        disabled={action.busy}
        onClick={() => setMembersOpen(true)}
      >
        直接搜索姓名，选择分摊人
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link href={`/west-pocket/${pocketId}`}>保存草稿，稍后继续</Link>
      </Button>
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
        retry={result.refresh}
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
