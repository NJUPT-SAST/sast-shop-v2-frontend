"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getPocketPayment, payBill } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { CopyButton } from "@workspace/ui/components/copy-button";
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
} from "@/lib/west-pocket";
import { PaymentQrCode } from "../payment-qr-code";
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
  const action = usePocketAction();
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
    !payment?.isOwner &&
    payment?.pocket.status === "collecting" &&
    bill?.status === "unpaid" &&
    bill.updatedAt &&
    payment.qrContent,
  );
  return (
    <div className="space-y-5 py-6">
      <PocketHeading title={payment?.pocket.title || "我的 AA 账单"} />
      <PocketError
        message={result.error || action.error}
        retry={result.refresh}
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
            <Link href={`/west-pocket/${pocketId}`}>查看收款汇总</Link>
          </Button>
        </>
      ) : payment && bill ? (
        <>
          <section className="space-y-3 rounded-xl border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">我的分摊金额</p>
            <p className="text-4xl font-semibold tabular-nums">
              {pocketMoney(bill.amountCents)}
            </p>
            <p className="text-sm">{pocketPaymentLabel(bill.status)}</p>
            <div className="flex items-center justify-center text-xs text-muted-foreground">
              <span>复制金额</span>
              <CopyButton
                value={(bill.amountCents / 100).toFixed(2)}
                label="分摊金额"
              />
            </div>
          </section>
          <dl className="grid grid-cols-[auto_1fr] gap-3 text-sm">
            <dt className="text-muted-foreground">收款人</dt>
            <dd className="break-words text-right">
              {payment.payee?.name ?? bill.payee?.name ?? "待核对"}
            </dd>
            <dt className="text-muted-foreground">账单号</dt>
            <dd className="break-all text-right">{bill.billNo || bill.id}</dd>
            <dt className="text-muted-foreground">付款标识码</dt>
            <dd className="flex items-center justify-end gap-1 font-semibold">
              {bill.verifyCode}
              <CopyButton value={bill.verifyCode} label="付款标识码" />
            </dd>
          </dl>
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
                保存收款码后，在微信中扫一扫并从相册选择。请手动填写{" "}
                {pocketMoney(bill.amountCents)}，备注付款标识码{" "}
                {bill.verifyCode}。
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
                    anchor.download = `west-pocket-${pocketId}.png`;
                    anchor.click();
                  }
                }}
              >
                {savedImage ? "长按上方图片保存收款码" : "保存收款码"}
              </Button>
            </section>
          ) : null}
          {bill.status === "submitted" ? (
            <p className="rounded-lg bg-muted p-4 text-sm leading-6">
              已标记付款，等待收款人核对到账，无需重复付款。
            </p>
          ) : null}
          {bill.status === "completed" ? (
            <p className="rounded-lg bg-muted p-4 text-sm leading-6">
              收款人已确认到账，本次分摊已完成。
            </p>
          ) : null}
          {payment.pocket.status === "collecting" &&
          bill.status === "unpaid" &&
          !canPay &&
          !result.error ? (
            <p role="alert" className="text-sm text-muted-foreground">
              账单或收款码尚未准备好，请刷新后重试。
            </p>
          ) : null}
          {canPay ? (
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
          ) : null}
          <Button asChild variant="ghost" className="w-full">
            <Link href={`/west-pocket/${pocketId}`}>返回活动</Link>
          </Button>
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
          <DrawerHeader>
            <DrawerTitle>标记已付款</DrawerTitle>
            <DrawerDescription>
              只有完成微信转账后才标记。此操作不会自动扣款，仍需收款人确认到账。
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <PocketConsent
              checked={paid}
              onChange={setPaid}
              disabled={action.busy}
            >
              我已向 {payment?.payee?.name ?? "收款人"} 转账{" "}
              {pocketMoney(bill?.amountCents ?? 0)}。
            </PocketConsent>
            <PocketError message={result.error || action.error} />
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
