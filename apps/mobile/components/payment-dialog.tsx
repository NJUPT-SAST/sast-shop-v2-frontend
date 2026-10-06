"use client";

import { useRef, useState, type TouchEvent } from "react";
import { BrandIllustration } from "@/components/brand-illustration";
import {
  RiAlipayLine,
  RiCheckboxCircleLine,
  RiDownload2Line,
  RiQrScan2Line,
  RiUser3Line,
  RiWechatPayLine,
} from "@remixicon/react";
import { formatPrice } from "@sast-shop/domain";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { CopyButton } from "@workspace/ui/components/copy-button";
import { PaymentCodeHelp } from "@workspace/ui/components/payment-code-help";
import { Empty } from "@workspace/ui/components/empty";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

import { openPaymentScanner } from "@/lib/payment-app-links";
import type { PaymentPlatform } from "@/lib/payment-preferences";
import { PaymentQrCode } from "./payment-qr-code";

export type PaymentDialogStatus = "loading" | "ready" | "submitted" | "error";

export type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountCents: number;
  payeeName: string | null;
  payeeAvatarUrl?: string | null;
  verifyCode: string;
  qrCodes: Partial<Record<PaymentPlatform, string>>;
  defaultPlatform: PaymentPlatform;
  status: PaymentDialogStatus;
  errorMessage?: string;
  submitting?: boolean;
  onPay: (platform: PaymentPlatform) => void | Promise<void>;
  onCancelPayment: () => void;
  onRetry?: () => void;
};

const PAYMENT_PLATFORMS: Array<{
  platform: PaymentPlatform;
  label: string;
  scannerLabel: string;
  icon: typeof RiWechatPayLine;
}> = [
  {
    platform: "wechat",
    label: "微信支付",
    scannerLabel: "微信",
    icon: RiWechatPayLine,
  },
  {
    platform: "alipay",
    label: "支付宝",
    scannerLabel: "支付宝",
    icon: RiAlipayLine,
  },
];

export function PaymentDialog({
  open,
  onOpenChange,
  ...props
}: PaymentDialogProps) {
  return (
    <ResponsiveDialog forceDrawer open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PaymentDialogBody key={props.defaultPlatform} {...props} />
      ) : null}
    </ResponsiveDialog>
  );
}

function PaymentDialogBody({
  amountCents,
  payeeName,
  payeeAvatarUrl,
  verifyCode,
  qrCodes,
  defaultPlatform,
  status,
  errorMessage,
  submitting = false,
  onPay,
  onCancelPayment,
  onRetry,
}: Omit<PaymentDialogProps, "open" | "onOpenChange">) {
  const [platform, setPlatform] = useState<PaymentPlatform>(defaultPlatform);
  const [savedPlatforms, setSavedPlatforms] = useState<
    Partial<Record<PaymentPlatform, boolean>>
  >({});
  const [attemptedPlatforms, setAttemptedPlatforms] = useState<
    Partial<Record<PaymentPlatform, boolean>>
  >({});
  const [transitionDirection, setTransitionDirection] = useState<
    "previous" | "next"
  >("next");
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const qrCanvasRefs = useRef<
    Partial<Record<PaymentPlatform, HTMLCanvasElement | null>>
  >({});
  const qrCodeContent = qrCodes[platform];
  const hasQrCode = Boolean(qrCodeContent);

  function openScanner() {
    if (!qrCodeContent) {
      toast.error("当前支付方式暂无收款码");
      return;
    }

    try {
      openPaymentScanner(platform);
      setAttemptedPlatforms((current) => ({ ...current, [platform]: true }));
    } catch {
      toast.error("无法打开支付 App，请手动打开扫一扫");
    }
  }

  function saveQrCode() {
    const canvas = qrCanvasRefs.current[platform];

    if (!canvas) {
      toast.error("当前支付方式暂无可保存的收款码");
      return;
    }

    const platformLabel = PAYMENT_PLATFORMS.find(
      (item) => item.platform === platform,
    )?.label;
    const link = document.createElement("a");

    link.href = canvas.toDataURL("image/png");
    link.download = `${platformLabel ?? "支付"}收款码.png`;
    link.click();
    setSavedPlatforms((current) => ({ ...current, [platform]: true }));
    toast.success("已发起保存，请在系统提示中确认");
  }

  function handlePay() {
    if (!qrCodeContent || submitting || status !== "ready") {
      return;
    }

    try {
      void Promise.resolve(onPay(platform)).catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "支付提交失败，请稍后再试",
        );
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "支付提交失败，请稍后再试",
      );
    }
  }

  function switchPlatform(direction: 1 | -1) {
    const currentIndex = PAYMENT_PLATFORMS.findIndex(
      (item) => item.platform === platform,
    );
    const nextIndex = currentIndex + direction;
    const nextPlatform = PAYMENT_PLATFORMS[nextIndex]?.platform;

    if (nextPlatform) {
      selectPlatform(nextPlatform);
    }
  }

  function selectPlatform(nextPlatform: PaymentPlatform) {
    if (nextPlatform === platform) return;
    const currentIndex = PAYMENT_PLATFORMS.findIndex(
      (item) => item.platform === platform,
    );
    const nextIndex = PAYMENT_PLATFORMS.findIndex(
      (item) => item.platform === nextPlatform,
    );
    setTransitionDirection(nextIndex > currentIndex ? "next" : "previous");
    setPlatform(nextPlatform);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];

    touchStartRef.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) {
      return;
    }

    switchPlatform(deltaX < 0 ? 1 : -1);
  }

  return (
    <ResponsiveDialogContent className="max-h-[94dvh] overflow-hidden px-4 pb-0 md:pb-4 sm:mx-auto sm:max-w-md">
      <ResponsiveDialogHeader className="px-0 py-3">
        <ResponsiveDialogTitle className="text-lg">支付</ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="sr-only">
          支付状态
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex min-h-0 flex-col overflow-y-auto py-1">
        {status === "loading" ? <PaymentDialogSkeleton /> : null}
        {status === "error" ? (
          onRetry ? (
            <LoadFailure
              title="支付账单加载失败"
              description={
                errorMessage ?? "请稍后重试，或联系收款人确认收款信息。"
              }
              onRetry={onRetry}
            />
          ) : (
            <LoadFailure
              title="支付账单加载失败"
              description={
                errorMessage ?? "请稍后重试，或联系收款人确认收款信息。"
              }
            />
          )
        ) : null}
        {status === "submitted" ? (
          <Empty
            icon={<RiCheckboxCircleLine className="size-5 text-primary" />}
            title="已提交支付确认"
            description="订单已进入待确认收款状态，请等待收款人核验。"
          />
        ) : null}
        {status === "ready" ? (
          <div className="flex flex-col gap-3">
            <PaymentBillSummary
              amountCents={amountCents}
              payeeName={payeeName}
              payeeAvatarUrl={payeeAvatarUrl}
              verifyCode={verifyCode}
            />
            <Tabs
              value={platform}
              onValueChange={(value) =>
                selectPlatform(value as PaymentPlatform)
              }
              className="min-h-0 flex-col"
            >
              <TabsList className="grid w-full grid-cols-2">
                {PAYMENT_PLATFORMS.map(
                  ({ platform: value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value}>
                      <Icon
                        data-icon="inline-start"
                        aria-hidden="true"
                        className={
                          value === "wechat"
                            ? "text-[#07c160]"
                            : "text-[#1677ff]"
                        }
                      />
                      {label}
                    </TabsTrigger>
                  ),
                )}
              </TabsList>
              {PAYMENT_PLATFORMS.map(
                ({ platform: value, label, scannerLabel }) => {
                  const panelQrCodeContent = qrCodes[value];
                  const panelHasQrCode = Boolean(panelQrCodeContent);
                  const panelQrSaved = Boolean(savedPlatforms[value]);
                  const panelScannerAttempted = Boolean(
                    attemptedPlatforms[value],
                  );

                  return (
                    <TabsContent
                      key={value}
                      value={value}
                      className={cn(
                        "mt-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
                        transitionDirection === "next"
                          ? "motion-safe:slide-in-from-right-3"
                          : "motion-safe:slide-in-from-left-3",
                      )}
                    >
                      <div
                        className="flex flex-col gap-4"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={() => {
                          touchStartRef.current = null;
                        }}
                      >
                        <div
                          className={cn(
                            "flex flex-col items-center gap-3",
                            panelHasQrCode && "rounded-lg bg-muted p-3",
                          )}
                        >
                          {panelQrCodeContent ? (
                            <PaymentQrCode
                              content={panelQrCodeContent}
                              channel={value}
                              canvasRef={(canvas) => {
                                qrCanvasRefs.current[value] = canvas;
                              }}
                            />
                          ) : (
                            <Empty
                              illustration={
                                <BrandIllustration
                                  name="collection"
                                  size={80}
                                />
                              }
                              title="暂无收款码"
                              description={`收款人还没有配置${label}收款码。`}
                            />
                          )}
                        </div>

                        <Separator />

                        <div className="grid gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!panelHasQrCode}
                            onClick={saveQrCode}
                          >
                            {panelQrSaved ? (
                              <RiCheckboxCircleLine data-icon="inline-start" />
                            ) : (
                              <RiDownload2Line data-icon="inline-start" />
                            )}
                            {panelQrSaved ? "收款码已保存" : "保存收款码"}
                          </Button>
                          <Button
                            type="button"
                            variant={panelQrSaved ? "secondary" : "outline"}
                            disabled={!panelHasQrCode || !panelQrSaved}
                            onClick={openScanner}
                          >
                            {panelScannerAttempted ? (
                              <RiCheckboxCircleLine data-icon="inline-start" />
                            ) : (
                              <RiQrScan2Line data-icon="inline-start" />
                            )}
                            {panelScannerAttempted
                              ? `已尝试打开${scannerLabel}`
                              : `打开${scannerLabel}扫一扫`}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  );
                },
              )}
            </Tabs>
          </div>
        ) : null}
      </div>

      {status === "ready" ? (
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={onCancelPayment}>
            稍后支付
          </Button>
          <Button
            type="button"
            disabled={!hasQrCode || submitting}
            onClick={handlePay}
          >
            <RiCheckboxCircleLine data-icon="inline-start" />
            {submitting ? "提交中" : `我已支付 · ${formatPrice(amountCents)}`}
          </Button>
        </ResponsiveDialogFooter>
      ) : status === "submitted" ? (
        <ResponsiveDialogFooter>
          <Button type="button" onClick={onCancelPayment}>
            完成
          </Button>
        </ResponsiveDialogFooter>
      ) : status === "error" ? (
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={onCancelPayment}>
            关闭
          </Button>
        </ResponsiveDialogFooter>
      ) : null}
    </ResponsiveDialogContent>
  );
}

function PaymentDialogSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2 rounded-lg bg-muted/70 p-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-10 items-center justify-between gap-3"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-4">
        <Skeleton className="size-44 rounded-lg" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
    </div>
  );
}

function PaymentBillSummary({
  amountCents,
  payeeName,
  payeeAvatarUrl,
  verifyCode,
}: {
  amountCents: number;
  payeeName: string | null;
  payeeAvatarUrl?: string | null;
  verifyCode: string;
}) {
  const isShortVerifyCode = verifyCode.length <= 8;
  const name = payeeName?.trim();

  return (
    <dl className="shrink-0 divide-y divide-border/70 rounded-lg bg-muted/70 px-3">
      <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
        <dt className="shrink-0 text-sm text-muted-foreground">金额</dt>
        <dd className="text-lg font-semibold tabular-nums text-primary">
          {formatPrice(amountCents)}
        </dd>
      </div>
      <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
        <dt className="shrink-0 text-sm text-muted-foreground">收款人</dt>
        <dd className="flex min-w-0 items-center justify-end gap-2 text-sm font-medium">
          <Avatar className="size-6" aria-hidden="true">
            <AvatarImage src={payeeAvatarUrl || undefined} alt="" />
            <AvatarFallback className="bg-background text-xs">
              {name ? Array.from(name)[0] : <RiUser3Line className="size-4" />}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 break-all text-right">
            {name || "未提供姓名"}
          </span>
        </dd>
      </div>

      <div className="flex min-h-12 items-center justify-between gap-4 py-1">
        <dt className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
          付款标识码
          <PaymentCodeHelp presentation="drawer" />
        </dt>
        <dd className="flex min-w-0 items-center justify-end gap-1">
          <span
            className={cn(
              "min-w-0 break-all text-right font-mono font-semibold tabular-nums",
              isShortVerifyCode
                ? "text-lg tracking-[0.15em]"
                : "text-base leading-6 tracking-normal",
            )}
          >
            {verifyCode}
          </span>
          {verifyCode ? (
            <CopyButton value={verifyCode} label="付款标识码" />
          ) : null}
        </dd>
      </div>
    </dl>
  );
}
