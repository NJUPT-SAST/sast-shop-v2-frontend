"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPocketPayment, payBill } from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { PaymentBillCard } from "../payment-bill-card";
import { PaymentDialog, type PaymentDialogStatus } from "../payment-dialog";
import { MobileFixedFooter } from "../mobile-fixed-footer";
import { pocketStatusLabel } from "@/lib/pocket";
import {
  PocketError,
  PocketLoading,
  usePocketAction,
  usePocketOptions,
  usePocketPolling,
  usePocketResource,
} from "./shared";

export function PocketPaymentSection({
  pocketId,
  initiallyOpen = false,
  onChanged,
}: {
  pocketId: string;
  initiallyOpen?: boolean;
  onChanged?: () => void;
}) {
  const activePocketId = useRef<string | null>(null);
  useEffect(() => {
    activePocketId.current = pocketId;
    return () => {
      activePocketId.current = null;
    };
  }, [pocketId]);
  const options = usePocketOptions();
  const result = usePocketResource(
    useCallback(() => getPocketPayment(pocketId, options), [pocketId, options]),
  );
  const action = usePocketAction({
    transaction: true,
    reconcile: async () => {
      if (activePocketId.current !== pocketId) return false;
      const latest = await result.refreshFresh();
      if (latest && activePocketId.current === pocketId) onChanged?.();
      return Boolean(latest);
    },
  });
  const [open, setOpen] = useState(initiallyOpen);
  // A route change or failed refresh must not expose a previous payable snapshot.
  const payment = result.data?.pocket.id === pocketId ? result.data : null;
  const bill = payment?.bill;
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
  const unavailableMessage =
    result.error ||
    action.error ||
    (action.pending
      ? "支付结果尚未确认，请重新加载核实后再操作"
      : cancelled
        ? "活动已取消或正在取消，请勿继续转账"
        : payment?.isOwner
          ? "你是收款人，无需向自己转账"
          : bill?.status === "completed"
            ? "已确认到账，本次分摊已完成"
            : "账单或收款码尚未准备好，请刷新重试");
  const dialogStatus: PaymentDialogStatus =
    result.error || action.pending || cancelled || payment?.isOwner
      ? "error"
      : !payment
        ? "loading"
        : bill?.status === "submitted"
          ? "submitted"
          : canPay
            ? "ready"
            : "error";
  function changeOpen(nextOpen: boolean) {
    if (action.busy) return;
    setOpen(nextOpen);
  }
  return (
    <section aria-label="我的分摊账单" className="flex min-w-0 flex-col gap-3">
      <PocketError
        message={result.error || action.error}
        retry={action.pending ? action.recover : result.refresh}
      />
      {!payment && !result.error ? <PocketLoading /> : null}
      {bill && !payment?.isOwner ? <PaymentBillCard bill={bill} /> : null}
      {cancelled ? (
        <Alert>
          <AlertDescription>
            活动{pocketStatusLabel(payment!.pocket.status)}
            ，请勿转账；已付款请联系收款人核对
          </AlertDescription>
        </Alert>
      ) : result.error && payment ? (
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          暂时无法核实最新账单状态，请重新加载后再付款
        </p>
      ) : payment && !bill && !payment.isOwner ? (
        <p className="text-sm text-muted-foreground">
          账单暂未就绪，请稍后刷新
        </p>
      ) : null}
      {canPay ? (
        <MobileFixedFooter>
          <Button
            size="touch"
            className="w-full"
            disabled={action.busy}
            onClick={() => changeOpen(true)}
          >
            去付款
          </Button>
        </MobileFixedFooter>
      ) : null}
      <PaymentDialog
        key={`${pocketId}:${bill?.id ?? "loading"}:${bill?.updatedAt ?? ""}`}
        open={open}
        onOpenChange={changeOpen}
        amountCents={bill?.amountCents ?? 0}
        payeeName={payment?.payee?.name ?? bill?.payee?.name ?? null}
        payeeAvatarUrl={
          payment?.payee?.avatarUrl ?? bill?.payee?.avatarUrl ?? null
        }
        verifyCode={bill?.verifyCode ?? ""}
        qrCodes={canPay ? { wechat: payment!.qrContent } : {}}
        defaultPlatform="wechat"
        allowedPlatforms={["wechat"]}
        dismissible={!action.busy}
        status={dialogStatus}
        errorMessage={unavailableMessage}
        submitting={action.busy}
        onPay={async (platform) => {
          if (platform !== "wechat" || !canPay || !bill?.updatedAt || !payment)
            return;
          const updatedAt = bill.updatedAt;
          await action.run(`pay:${bill.id}:${updatedAt}`, async () => {
            if (activePocketId.current !== pocketId) return;
            const updatedBill = await payBill(
              {
                billId: bill.id,
                updatedAt,
                channel: "wechat",
              },
              options,
            );
            if (activePocketId.current !== pocketId) return;
            result.setData({ ...payment, bill: updatedBill });
            const latest = await result.refreshFresh();
            if (latest && activePocketId.current === pocketId) onChanged?.();
          });
        }}
        onCancelPayment={() => changeOpen(false)}
        onRetry={action.pending ? action.recover : result.refresh}
      />
    </section>
  );
}
