"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/mobile-link";
import { RiDeleteBinLine, RiSearchLine, RiUploadLine } from "@remixicon/react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field";
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
  PocketNotice,
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
      <div className="flex min-w-0 flex-1 flex-col gap-4 py-4">
        <PocketHeading title="选择分摊人" />
        <PocketError
          message={detail.error}
          retry={action.pending ? action.recover : detail.refresh}
        />
        {!detail.error ? <PocketLoading /> : null}
      </div>
    );
  if (!current.isOwner || current.pocket.status !== "draft")
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4 py-4">
        <PocketHeading title="选择分摊人" />
        <p className="text-sm leading-6 text-muted-foreground">
          {current.isOwner
            ? `活动${pocketStatusLabel(current.pocket.status)}，无法修改名单`
            : "仅发起人可修改名单和上传合照"}
        </p>
        <Button asChild variant="outline" size="touch">
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
        setProgress("");
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
    <div className="flex min-w-0 flex-1 flex-col gap-4 py-4">
      <PocketHeading title="选择分摊人" />
      {!canUpload ? (
        <PocketNotice>
          {capabilities.error ||
            (caps ? "合照功能暂未开放" : "正在检查合照服务")}
        </PocketNotice>
      ) : null}
      <Card aria-label="聚餐信息">
        <CardHeader className="gap-1 px-3 py-3">
          <CardTitle className="break-words text-base leading-6">
            {current.pocket.title || "Pocket"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 px-3 pb-3 text-sm">
          <span className="text-muted-foreground">总金额</span>
          <span className="shrink-0 font-semibold tabular-nums text-primary">
            {pocketMoney(current.pocket.totalCents)}
          </span>
        </CardContent>
      </Card>
      <PocketError
        message={detail.error || action.error}
        retry={action.pending ? action.recover : detail.refresh}
      />
      <Button
        variant={canUpload ? "outline" : "default"}
        size="touch"
        className="w-full"
        disabled={action.busy || Boolean(detail.error)}
        onClick={() => setMembersOpen(true)}
      >
        <RiSearchLine data-icon="inline-start" />
        搜索姓名选人
      </Button>
      {canUpload ? (
        <>
          <FieldSet className="gap-3 border-t pt-4">
            <FieldLegend variant="label" className="mb-0">
              合照选人
            </FieldLegend>
            <FieldDescription className="leading-6">
              合照私密保存，腾讯云仅匹配已授权人脸，结果需核对。请先征得入镜者同意，并裁剪或遮挡旁人
            </FieldDescription>
            <FieldGroup className="gap-0">
              <PocketConsent
                checked={consented}
                onChange={setConsented}
                disabled={action.busy}
              >
                入镜者均已知情同意用合照识别选人
              </PocketConsent>
              <PocketConsent
                checked={album}
                onChange={setAlbum}
                disabled={action.busy}
              >
                保留为聚餐合照，仅同意访问的成员可查看
              </PocketConsent>
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              临时合照 24 小时后删除，留念合照 30 天后删除
            </p>
          </FieldSet>
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
            size="touch"
            className="w-full"
            disabled={action.busy || !consented || !photos.length}
            onClick={() => void upload()}
          >
            {action.busy ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RiUploadLine data-icon="inline-start" />
            )}
            {caps?.faceRecognitionAvailable ? "上传并识别" : "上传合照"}
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
      ) : null}
      {activeJob ? (
        <RecognitionProgress
          jobId={activeJob.id}
          onCompleted={completed}
          onUpdate={setJob}
        />
      ) : null}
      {current.photos.length ? (
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-sm font-semibold">
            已上传 {current.photos.length} 张
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {current.photos.map((photo, index) => (
              <div key={photo.id} className="flex min-w-0 flex-col gap-2">
                <div className="relative">
                  <ManagedImage
                    src={photo.previewUrl}
                    alt={`聚餐合照 ${index + 1}`}
                    className="aspect-[4/3] rounded-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon-xs"
                    className="absolute right-2 top-2 bg-card text-destructive"
                    aria-label={`删除合照 ${index + 1}`}
                    disabled={action.busy}
                    onClick={() => setDeletingPhoto(photo.id)}
                  >
                    <RiDeleteBinLine />
                  </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {photo.detectedFaceCount > 0
                    ? `检测到 ${photo.detectedFaceCount} 张人脸`
                    : "等待识别"}
                  {photo.errorCode ? " · 请补拍或手选" : ""}
                </p>
              </div>
            ))}
          </div>
          {caps?.faceRecognitionAvailable ? (
            <Button
              variant="outline"
              size="touch"
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
              重新识别
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
    <div className="flex min-w-0 flex-col gap-3">
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
      ) : !result.error ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner />
          正在加载识别进度
        </div>
      ) : null}
    </div>
  );
}
