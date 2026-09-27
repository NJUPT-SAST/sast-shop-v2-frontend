"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  enrollPocketFace,
  getMyPocketFace,
  getPocketCapabilities,
  getPocketJob,
  retryPocketJob,
  revokePocketFace,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { pocketJobFinished } from "@/lib/west-pocket";
import { uploadPocketPhoto, type PocketUpload } from "@/lib/west-pocket-upload";
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

export function PocketFacePage() {
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(
      async () => ({ profile: await getMyPocketFace(options) }),
      [options],
    ),
  );
  const capabilities = usePocketResource(
    useCallback(() => getPocketCapabilities(options), [options]),
  );
  const action = usePocketAction();
  const [photos, setPhotos] = useState<SelectedPocketPhoto[]>([]);
  const [consented, setConsented] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobPending, setJobPending] = useState(false);
  const [progress, setProgress] = useState("");
  const uploads = useRef(new Map<string, PocketUpload>());
  const profile = result.data?.profile;
  const caps = capabilities.data;
  const statusLabels: Record<string, string> = {
    pending: "正在录入",
    active: "已录入",
    revoking: "已停止识别，正在删除",
    revoked: "已撤回并删除",
    failed: "录入未完成",
    expired: "授权已到期",
  };
  const processing =
    profile?.status === "pending" ||
    profile?.status === "revoking" ||
    jobPending;
  usePocketPolling(result.refresh, processing);
  const available = Boolean(
    caps?.faceRecognitionAvailable &&
    caps.photoUploadAvailable &&
    caps.faceConsentVersion,
  );
  const visibleJobId = jobId ?? profile?.jobId;
  return (
    <div className="space-y-5 py-6">
      <PocketHeading
        title="我的人脸"
        description="合照中快速找到你，仅用于 West Pocket 建议名单。"
      />
      <PocketError
        message={result.error || action.error}
        retry={result.refresh}
      />
      {!result.data && !result.error ? <PocketLoading /> : null}
      {result.data ? (
        <>
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <p className="font-semibold">
              {profile
                ? (statusLabels[profile.status] ?? "状态待更新")
                : "尚未录入"}
            </p>
            {profile?.status === "active" ? (
              <p className="text-sm text-muted-foreground">
                已保存 {profile.sampleCount} 张有效样本。
                {profile.consentExpiresAt
                  ? `授权至 ${new Date(profile.consentExpiresAt).toLocaleDateString("zh-CN")}。`
                  : ""}
              </p>
            ) : null}
            {profile?.status === "revoking" ? (
              <p className="text-sm leading-6 text-muted-foreground">
                你的账户已退出人脸匹配。系统正在删除云端人脸与临时照片，完成后会更新状态。
              </p>
            ) : null}
          </section>
          {visibleJobId ? (
            <FaceJob
              key={visibleJobId}
              jobId={visibleJobId}
              onFinished={result.refresh}
              onPending={setJobPending}
            />
          ) : null}
          {!available ? (
            <p className="rounded-lg bg-muted p-3 text-sm leading-6">
              {capabilities.error ||
                "人脸录入暂未开放，你仍可通过姓名搜索参与 AA。"}
            </p>
          ) : !processing ? (
            <>
              <div className="space-y-3 text-sm leading-6">
                <h2 className="font-semibold">
                  {profile?.status === "active"
                    ? "重新录入本人照片"
                    : "录入本人照片"}
                </h2>
                <p className="text-muted-foreground">
                  选择 1–3
                  张仅有本人、正脸清晰的照片。腾讯云将处理并保存人脸特征，绑定到你的登录账户；原始照片处理后删除。授权有效期为一年，你可以随时撤回并删除；不录入不影响使用姓名搜索和付款。
                </p>
                <PocketConsent
                  checked={consented}
                  onChange={setConsented}
                  disabled={action.busy}
                >
                  我已阅读并单独同意上述人脸信息处理，仅上传本人的照片。
                </PocketConsent>
                <p className="text-xs text-muted-foreground">
                  告知版本：{caps?.faceConsentVersion}
                </p>
              </div>
              <PocketPhotoPicker
                face
                photos={photos}
                onChange={setPhotos}
                disabled={action.busy || !consented}
                maxPhotos={3}
              />
              <Button
                className="w-full"
                size="lg"
                disabled={action.busy || !consented || !photos.length}
                onClick={() =>
                  void action.run(
                    `enroll:${profile?.revision ?? "new"}:${photos.map((photo) => photo.id).join(",")}`,
                    async (requestId) => {
                      if (!caps) return;
                      const uploadIds: string[] = [];
                      for (let index = 0; index < photos.length; index++) {
                        const photo = photos[index]!;
                        setProgress(
                          `正在上传 ${index + 1} / ${photos.length} 张`,
                        );
                        let uploaded = uploads.current.get(photo.id);
                        if (!uploaded) {
                          uploaded = await uploadPocketPhoto(photo.file, {
                            purpose: "face_sample",
                            consentVersion: caps.faceConsentVersion,
                            requestId: photo.id,
                          });
                          uploads.current.set(photo.id, uploaded);
                        }
                        uploadIds.push(uploaded.uploadId);
                      }
                      const response = await enrollPocketFace(
                        {
                          uploadIds,
                          consentVersion: caps.faceConsentVersion,
                          requestId,
                          expectedRevision:
                            profile &&
                            !["revoked", "failed"].includes(profile.status)
                              ? profile.revision
                              : undefined,
                        },
                        options,
                      );
                      result.setData({ profile: response.profile });
                      setJobId(response.job?.id ?? null);
                      setJobPending(
                        Boolean(
                          response.job &&
                          !pocketJobFinished(response.job.status),
                        ),
                      );
                      setPhotos([]);
                      setConsented(false);
                      setProgress("已提交，正在检查照片并录入");
                    },
                  )
                }
              >
                {action.busy ? <Spinner /> : null}
                {profile?.status === "active" ? "提交重新录入" : "同意并录入"}
              </Button>
              {progress ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {progress}
                </p>
              ) : null}
            </>
          ) : null}
          {profile && !["revoking", "revoked"].includes(profile.status) ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={action.busy}
              onClick={() => setRevokeOpen(true)}
            >
              撤回授权并删除人脸
            </Button>
          ) : null}
        </>
      ) : null}
      <Button asChild variant="ghost" className="w-full">
        <Link href="/west-pocket">前往 West Pocket</Link>
      </Button>
      <Drawer
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        dismissible={!action.busy}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>撤回人脸授权</DrawerTitle>
            <DrawerDescription>
              立即停止将你列入新的识别候选，并删除腾讯云人脸与临时照片。正在进行的
              AA 和付款不受影响。
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <PocketError message={action.error} />
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              variant="destructive"
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  `revoke:${profile?.revision}`,
                  async (requestId) => {
                    if (!profile) return;
                    const response = await revokePocketFace(
                      { expectedRevision: profile.revision, requestId },
                      options,
                    );
                    result.setData({ profile: response.profile });
                    setJobId(response.job?.id ?? null);
                    setJobPending(
                      Boolean(
                        response.job && !pocketJobFinished(response.job.status),
                      ),
                    );
                    setRevokeOpen(false);
                    setPhotos([]);
                    setConsented(false);
                  },
                )
              }
            >
              确认撤回并删除
            </Button>
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() => setRevokeOpen(false)}
            >
              继续保留
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function FaceJob({
  jobId,
  onFinished,
  onPending,
}: {
  jobId: string;
  onFinished: () => void;
  onPending: (pending: boolean) => void;
}) {
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getPocketJob(jobId, options), [jobId, options]),
  );
  const action = usePocketAction();
  const notified = useRef(false);
  usePocketPolling(
    result.refresh,
    !result.data || !pocketJobFinished(result.data.status),
  );
  useEffect(() => {
    const updated = result.data;
    if (!updated) return;
    const timer = window.setTimeout(() => {
      onPending(!pocketJobFinished(updated.status));
      if (pocketJobFinished(updated.status) && !notified.current) {
        notified.current = true;
        onFinished();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [result.data, onFinished, onPending]);
  return (
    <div className="space-y-2">
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
              notified.current = false;
              result.setData(
                await retryPocketJob({ jobId, requestId }, options),
              );
            })
          }
        />
      ) : null}
    </div>
  );
}
