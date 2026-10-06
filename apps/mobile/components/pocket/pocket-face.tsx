"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  enrollPocketFace,
  getMyPocketFace,
  getPocketCapabilities,
  getPocketJob,
  retryPocketJob,
  revokePocketFace,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { TextHighlight } from "@workspace/ui/components/text-highlight";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { pocketJobFinished } from "@/lib/pocket";
import { uploadPocketPhoto, type PocketUpload } from "@/lib/pocket-upload";
import { BrandIllustration } from "../brand-illustration";
import { PocketPhotoPicker, type SelectedPocketPhoto } from "./photo-picker";
import {
  PocketConsent,
  PocketError,
  PocketHeading,
  PocketJobProgress,
  PocketNotice,
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
  const action = usePocketAction({
    reconcile: async () => Boolean(await result.refreshFresh()),
  });
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
  const statusIllustrations: Record<
    string,
    ComponentProps<typeof BrandIllustration>["name"]
  > = {
    pending: "face",
    active: "face-active",
    revoking: "face-inactive",
    revoked: "face-inactive",
    expired: "face-inactive",
    failed: "load-error",
  };
  const statusVariants: Record<string, BadgeProps["variant"]> = {
    pending: "review",
    active: "success",
    revoking: "attention",
    revoked: "muted",
    failed: "danger",
    expired: "muted",
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
    <div className="flex flex-col gap-4 py-6">
      <PocketHeading title="人脸录入" />
      {!available && (caps || capabilities.error) ? (
        <PocketNotice>
          {capabilities.error || "人脸录入暂未开放，可通过姓名选人"}
        </PocketNotice>
      ) : null}
      {result.error || action.error ? (
        <div className="flex items-center gap-3">
          {result.error ? (
            <BrandIllustration name="load-error" size={56} />
          ) : null}
          <div className="min-w-0 flex-1">
            <PocketError
              message={result.error || action.error}
              retry={action.pending ? action.recover : result.refresh}
            />
          </div>
        </div>
      ) : null}
      {!result.data && !result.error ? (
        <section
          role="status"
          className="flex items-center gap-3 rounded-lg border bg-card p-3"
        >
          <BrandIllustration name="face" size={56} />
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4 shrink-0" aria-hidden="true" />
            正在加载人脸状态
          </p>
        </section>
      ) : null}
      {result.data ? (
        <>
          <section className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <BrandIllustration
              name={
                profile
                  ? (statusIllustrations[profile.status] ?? "face")
                  : "face-empty"
              }
              size={56}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                {profile?.status === "pending" ||
                profile?.status === "revoking" ? (
                  <Spinner className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
                <Badge
                  variant={
                    profile
                      ? (statusVariants[profile.status] ?? "muted")
                      : "muted"
                  }
                >
                  {profile
                    ? (statusLabels[profile.status] ?? "状态待更新")
                    : "尚未录入"}
                </Badge>
              </div>
              {profile?.status === "active" ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  有效样本 {profile.sampleCount} 张
                  {profile.consentExpiresAt
                    ? `，授权至 ${new Date(profile.consentExpiresAt).toLocaleDateString("zh-CN")}`
                    : ""}
                </p>
              ) : null}
              {profile?.status === "revoking" ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  正在删除云端人脸与临时照片
                </p>
              ) : null}
            </div>
          </section>
          {visibleJobId ? (
            <FaceJob
              key={visibleJobId}
              jobId={visibleJobId}
              onFinished={result.refresh}
              onPending={setJobPending}
            />
          ) : null}
          {available && !processing ? (
            <>
              <FieldGroup className="gap-3">
                <Field data-disabled={action.busy}>
                  <h2 className="text-base font-semibold">
                    {profile?.status === "active"
                      ? "重新录入本人照片"
                      : "录入本人照片"}
                  </h2>
                  <div className="flex flex-col gap-2">
                    <FieldDescription className="leading-6">
                      选择 1–3 张
                      <TextHighlight>仅有本人、正脸清晰</TextHighlight>
                      的照片。
                    </FieldDescription>
                    <FieldDescription className="leading-6">
                      腾讯云将<TextHighlight>处理并保存人脸特征</TextHighlight>
                      ，绑定到你的登录账户；
                      <TextHighlight>原始照片处理后删除</TextHighlight>。
                    </FieldDescription>
                    <FieldDescription className="leading-6">
                      授权有效期为<TextHighlight>一年</TextHighlight>，你可以
                      <TextHighlight>随时撤回并删除</TextHighlight>
                      ；不录入不影响使用姓名搜索和付款。
                    </FieldDescription>
                  </div>
                  <PocketConsent
                    checked={consented}
                    onChange={setConsented}
                    disabled={action.busy}
                  >
                    我已阅读并单独同意上述人脸信息处理，仅上传本人的照片。
                  </PocketConsent>
                </Field>
              </FieldGroup>
              <PocketPhotoPicker
                face
                photos={photos}
                onChange={setPhotos}
                disabled={action.busy}
                maxPhotos={3}
              />
              {photos.length ? (
                <Button
                  className="w-full"
                  size="touch"
                  disabled={action.busy || !consented || !photos.length}
                  onClick={() =>
                    void action.run(
                      `enroll:${profile?.revision ?? "new"}:${photos.map((photo) => photo.id).join(",")}`,
                      async (requestId) => {
                        if (!caps || !consented || !photos.length) return;
                        const uploadIds: string[] = [];
                        for (let index = 0; index < photos.length; index++) {
                          const photo = photos[index]!;
                          setProgress(
                            `正在上传 ${index + 1} / ${photos.length} 张`,
                          );
                          let uploaded = uploads.current.get(photo.id);
                          if (
                            !uploaded ||
                            Date.parse(uploaded.expiresAt) <= Date.now()
                          ) {
                            uploaded = await uploadPocketPhoto(photo.file, {
                              purpose: "face_sample",
                              consentVersion: caps.faceConsentVersion,
                              requestId: uploaded
                                ? crypto.randomUUID()
                                : photo.id,
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
                  {action.busy ? <Spinner data-icon="inline-start" /> : null}
                  录入
                </Button>
              ) : null}
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
              size="touch"
              className="w-full"
              disabled={action.busy}
              onClick={() => setRevokeOpen(true)}
            >
              撤回授权并删除人脸
            </Button>
          ) : null}
        </>
      ) : null}
      <Drawer
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        dismissible={!action.busy}
      >
        <DrawerContent className="overflow-clip">
          <DrawerHeader className="shrink-0 text-center">
            <DrawerTitle>撤回人脸授权</DrawerTitle>
            <DrawerDescription className="sr-only">
              停止人脸匹配，并删除已保存的人脸信息
            </DrawerDescription>
          </DrawerHeader>
          <div className="app-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
            <div className="flex items-start gap-3">
              <BrandIllustration name="face-inactive" size={48} />
              <p className="text-sm leading-6 text-muted-foreground">
                你的账户将退出识别候选，并
                <TextHighlight>删除腾讯云人脸与临时照片</TextHighlight>；
                <TextHighlight>正在进行的 Pocket 和付款不受影响</TextHighlight>
              </p>
            </div>
            <PocketError
              message={action.error}
              retry={action.pending ? action.recover : undefined}
            />
          </div>
          <DrawerFooter className="shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              size="touch"
              variant="outline"
              disabled={action.busy}
              onClick={() => setRevokeOpen(false)}
            >
              继续保留
            </Button>
            <Button
              size="touch"
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
    <div className="flex flex-col gap-2">
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
