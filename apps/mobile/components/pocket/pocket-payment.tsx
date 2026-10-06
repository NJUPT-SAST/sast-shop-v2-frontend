"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getPocketPayment, payBill } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { CopyButton } from "@workspace/ui/components/copy-button";
import { PaymentCodeHelp } from "@workspace/ui/components/payment-code-help";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@workspace/ui/components/field";
import { RiWechatPayLine } from "@remixicon/react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import {
  pocketMoney,
  pocketPaymentLabel,
  pocketStatusLabel,
} from "@/lib/pocket";
import { PaymentQrCode } from "../payment-qr-code";
import { MobileFixedFooter } from "../mobile-fixed-footer";
import {
  PocketConsent,
  PocketError,
  PocketHeading,
  PocketLoading,
  usePocketAction,
  usePocketOptions,
  usePocketPolling,
  usePocketResource,
} from "./shared";

export function PocketPaymentPage({ pocketId }: { pocketId: string }) {
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getPocketPayment(pocketId, options), [pocketId, options]),
  );
  const action = usePocketAction({
    transaction: true,
    reconcile: async () => Boolean(await result.refreshFresh()),
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [paid, setPaid] = useState(false);
  const [savedQr, setSavedQr] = useState<{
    pocketId: string;
    image: string;
  } | null>(null);
  // A route change or failed refresh must not expose a previous payable snapshot.
  const payment = result.data?.pocket.id === pocketId ? result.data : null;
  const bill = payment?.bill;
  const payee = payment?.payee ?? bill?.payee;
  const savedImage = savedQr?.pocketId === pocketId ? savedQr.image : "";
  const cancelled = Boolean(
    payment && ["cancelled", "cancelling"].includes(payment.pocket.status),
  );
  usePocketPolling(
    result.refresh,
    Boolean(
      payment &&
      (["publishing", "collecting", "cancelling"].includes(
        payment.pocket.status,
      ) ||
        bill?.status === "submitted"),
    ),
  );
  const canPay = Boolean(
    !result.error &&
    !action.pending &&
    !payment?.isOwner &&
    payment?.pocket.status === "collecting" &&
    bill?.status === "unpaid" &&
    bill.updatedAt &&
    payment.qrContent,
  );
  return (
    <div className="space-y-5 py-4">
      <PocketHeading title={payment?.pocket.title || "我的 Pocket 账单"} />
      <PocketError
        message={result.error || action.error}
        retry={action.pending ? action.recover : result.refresh}
      />
      {result.error && payment ? (
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          暂时无法核实最新账单状态，已暂停展示收款码和付款操作。请重新加载后再付款。
        </p>
      ) : null}
      {cancelled ? (
        <p className="rounded-lg bg-muted p-4 text-sm leading-6">
          活动{pocketStatusLabel(payment!.pocket.status)}
          ，请勿继续转账。若已经线下付款，请联系收款人核对。
        </p>
      ) : null}
      {!payment && !result.error ? <PocketLoading /> : null}
      {payment?.isOwner ? (
        <>
          <p className="text-sm text-muted-foreground">
            你是本次收款人，无需向自己转账。
          </p>
          <Button asChild className="w-full">
            <Link href={`/pocket/${pocketId}`}>查看收款汇总</Link>
          </Button>
        </>
      ) : payment && bill ? (
        <>
          <section
            aria-label="分摊账单"
            className="rounded-xl border bg-card px-4"
          >
            <dl className="divide-y divide-border/70">
              {payee ? (
                <div className="flex min-h-12 items-center justify-between gap-4 py-2">
                  <dt className="shrink-0 text-sm text-muted-foreground">
                    收款人
                  </dt>
                  <dd className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm">
                    <Avatar className="size-6 shrink-0">
                      <AvatarImage src={payee.avatarUrl} alt="" />
                      <AvatarFallback>{payee.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 break-words font-medium">
                      {payee.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <RiWechatPayLine
                        className="size-5 text-[#07c160]"
                        aria-hidden="true"
                      />
                      微信
                    </span>
                  </dd>
                </div>
              ) : null}
              <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
                <dt className="shrink-0 text-sm text-muted-foreground">
                  分摊金额
                </dt>
                <dd className="flex min-w-0 items-center justify-end gap-1">
                  <span className="text-lg font-semibold tabular-nums text-primary">
                    {pocketMoney(bill.amountCents)}
                  </span>
                  <CopyButton
                    value={(bill.amountCents / 100).toFixed(2)}
                    label="分摊金额"
                  />
                </dd>
              </div>
              <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
                <dt className="shrink-0 text-sm text-muted-foreground">
                  账单号
                </dt>
                <dd className="min-w-0 break-all text-right text-sm">
                  {bill.billNo || bill.id}
                </dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-4 py-1">
                <dt className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
                  付款标识码
                  <PaymentCodeHelp presentation="drawer" />
                </dt>
                <dd className="flex min-w-0 items-center justify-end gap-1">
                  <span className="break-all text-right font-mono font-semibold tabular-nums">
                    {bill.verifyCode}
                  </span>
                  <CopyButton value={bill.verifyCode} label="付款标识码" />
                </dd>
              </div>
            </dl>
            <p
              role="status"
              className="border-t border-border/70 py-3 text-sm leading-6 text-muted-foreground"
            >
              {bill.status === "submitted"
                ? "已标记付款，等待收款人核对到账，无需重复付款。"
                : bill.status === "completed"
                  ? "收款人已确认到账，本次分摊已完成。"
                  : pocketPaymentLabel(bill.status)}
            </p>
          </section>
          {canPay ? (
            <section className="space-y-4 rounded-xl border bg-card p-5">
              <div className="flex justify-center">
                {savedImage ? (
                  <Image
                    src={savedImage}
                    alt="微信收款码，可长按保存"
                    width={240}
                    height={240}
                    unoptimized
                  />
                ) : (
                  <PaymentQrCode
                    content={payment.qrContent}
                    channel="wechat"
                    size={240}
                    canvasRef={canvas}
                  />
                )}
              </div>
              <p className="text-center text-sm leading-6 text-muted-foreground">
                保存收款码，在微信扫一扫中从相册选择，按上方金额转账并备注付款标识码
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const data = canvas.current?.toDataURL("image/png");
                  if (data) {
                    setSavedQr({ pocketId, image: data });
                    const anchor = document.createElement("a");
                    anchor.href = data;
                    anchor.download = `pocket-${pocketId}.png`;
                    anchor.click();
                  }
                }}
              >
                {savedImage ? "长按上方图片保存收款码" : "保存收款码"}
              </Button>
            </section>
          ) : null}
          {payment.pocket.status === "collecting" &&
          bill.status === "unpaid" &&
          !canPay &&
          !action.pending &&
          !result.error ? (
            <p role="alert" className="text-sm text-muted-foreground">
              账单或收款码尚未准备好，请刷新后重试。
            </p>
          ) : null}
          {canPay ? (
            <MobileFixedFooter>
              <Button
                className="w-full"
                size="lg"
                disabled={action.busy}
                onClick={() => {
                  setPaid(false);
                  setConfirming(true);
                }}
              >
                我已付款
              </Button>
            </MobileFixedFooter>
          ) : null}
        </>
      ) : payment && !payment.isOwner && !cancelled ? (
        <p className="text-sm text-muted-foreground">
          账单尚未准备好，活动{pocketStatusLabel(payment.pocket.status)}
          。请稍后刷新。
        </p>
      ) : null}
      <Drawer
        open={confirming}
        onOpenChange={setConfirming}
        dismissible={!action.busy}
      >
        <DrawerContent>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>标记已付款</DrawerTitle>
            <DrawerDescription className="sr-only">
              完成微信转账后，再提交付款确认
            </DrawerDescription>
          </DrawerHeader>
          <div className="app-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
            {bill ? (
              <dl
                aria-label="付款核对信息"
                className="divide-y divide-border/70 rounded-lg bg-muted/70 px-3"
              >
                <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
                  <dt className="shrink-0 text-sm text-muted-foreground">
                    收款人
                  </dt>
                  <dd className="min-w-0 break-words text-right font-medium">
                    {payee?.name ?? "收款人"}
                  </dd>
                </div>
                <div className="flex min-h-10 items-center justify-between gap-4 py-1.5">
                  <dt className="shrink-0 text-sm text-muted-foreground">
                    转账金额
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums text-primary">
                    {pocketMoney(bill.amountCents)}
                  </dd>
                </div>
                <div className="flex min-h-12 items-center justify-between gap-4 py-1">
                  <dt className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    付款标识码
                    <PaymentCodeHelp presentation="drawer" />
                  </dt>
                  <dd className="min-w-0 break-all text-right font-mono font-semibold tabular-nums">
                    {bill.verifyCode}
                  </dd>
                </div>
              </dl>
            ) : null}
            <FieldGroup className="gap-3">
              <Field data-disabled={action.busy}>
                <PocketConsent
                  checked={paid}
                  onChange={setPaid}
                  disabled={action.busy}
                >
                  我已完成上述微信转账
                </PocketConsent>
                <FieldDescription>
                  提交不会自动扣款，仍需收款人核对到账
                </FieldDescription>
              </Field>
            </FieldGroup>
            <PocketError
              message={result.error || action.error}
              retry={action.pending ? action.recover : result.refresh}
            />
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              disabled={!paid || action.busy || !canPay}
              onClick={() =>
                void action.run(
                  `pay:${bill?.id}:${bill?.updatedAt}`,
                  async () => {
                    if (!canPay || !bill?.updatedAt) return;
                    await payBill(
                      {
                        billId: bill.id,
                        updatedAt: bill.updatedAt,
                        channel: "wechat",
                      },
                      options,
                    );
                    setConfirming(false);
                    result.refresh();
                  },
                )
              }
            >
              确认已付款
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
