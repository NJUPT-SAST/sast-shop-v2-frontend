"use client";

import { useRef, useState, type TouchEvent } from "react";
import {
  RiAlipayLine,
  RiCheckboxCircleLine,
  RiDownload2Line,
  RiKey2Line,
  RiQrCodeLine,
  RiQrScan2Line,
  RiWallet3Line,
  RiWechatPayLine,
} from "@remixicon/react";
import { formatPrice } from "@sast-shop/domain";
import { Button } from "@workspace/ui/components/button";
import { CopyButton } from "@workspace/ui/components/copy-button";
import { Empty } from "@workspace/ui/components/empty";
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
      void Promise.resolve(onPay(platform)).catch(() => {
        toast.error("支付提交失败，请稍后再试");
      });
    } catch {
      toast.error("支付提交失败，请稍后再试");
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
    <ResponsiveDialogContent className="max-h-[88dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
      <ResponsiveDialogHeader className="px-0">
        <ResponsiveDialogTitle className="text-lg">支付</ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="sr-only">
          支付状态
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex min-h-0 flex-col overflow-y-auto py-1">
        {status === "loading" ? <PaymentDialogSkeleton /> : null}
        {status === "error" ? (
          <Empty
            icon={<RiQrCodeLine className="size-5" />}
            title="获取支付账单失败"
            description={
              errorMessage ?? "请稍后重试，或联系收款人确认收款信息。"
            }
            action={
              onRetry ? (
                <Button type="button" variant="outline" onClick={onRetry}>
                  重试
                </Button>
              ) : null
            }
          />
        ) : null}
        {status === "submitted" ? (
          <Empty
            icon={<RiCheckboxCircleLine className="size-5 text-primary" />}
            title="已提交支付确认"
            description="订单已进入待确认收款状态，请等待收款人核验。"
          />
        ) : null}
        {status === "ready" ? (
          <Tabs
            value={platform}
            onValueChange={(value) => selectPlatform(value as PaymentPlatform)}
            className="min-h-0 flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              {PAYMENT_PLATFORMS.map(
                ({ platform: value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value}>
                    <Icon data-icon="inline-start" />
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
                      "mt-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
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
                      <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-4">
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
                            icon={<RiQrCodeLine className="size-5" />}
                            title="暂无收款码"
                            description={`收款人还没有配置${label}收款码。`}
                            className="w-full border bg-card text-card-foreground"
                          />
                        )}
                      </div>

                      <PaymentBillSummary
                        amountCents={amountCents}
                        verifyCode={verifyCode}
                      />

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
        ) : null}
      </div>

      {status === "ready" ? (
        <ResponsiveDialogFooter className="flex-col gap-1 pt-4">
          <Button
            type="button"
            disabled={!hasQrCode || submitting}
            onClick={handlePay}
          >
            <RiCheckboxCircleLine data-icon="inline-start" />
            {submitting ? "提交中" : "我已支付"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onCancelPayment}
          >
            稍后支付
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
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="flex flex-col items-center gap-3 rounded-lg bg-muted p-4">
        <Skeleton className="size-44 rounded-lg" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 rounded-md" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  );
}

function PaymentBillSummary({
  amountCents,
  verifyCode,
}: {
  amountCents: number;
  verifyCode: string;
}) {
  const isShortVerifyCode = verifyCode.length <= 8;

  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-lg bg-muted/70 px-3">
      <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <RiWallet3Line className="size-4" />
          金额
        </span>
        <span className="text-right text-xl font-semibold tabular-nums text-primary">
          {formatPrice(amountCents)}
        </span>
      </div>

      <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <RiKey2Line className="size-4" />
          付款标识码
        </span>
        <span className="flex min-w-0 items-center justify-end gap-1">
          <span
            className={cn(
              "min-w-0 break-all text-right font-mono font-semibold tabular-nums",
              isShortVerifyCode
                ? "text-2xl tracking-[0.2em]"
                : "text-base leading-6 tracking-normal",
            )}
          >
            {verifyCode}
          </span>
          {verifyCode ? (
            <CopyButton value={verifyCode} label="付款标识码" />
          ) : null}
        </span>
      </div>
    </div>
  );
}
