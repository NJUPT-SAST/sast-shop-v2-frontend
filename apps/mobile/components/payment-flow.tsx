"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBill,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type DataSource,
  type PaymentBill,
  type PaymentQrCode,
} from "@sast-shop/api";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";

import type { PaymentPlatform } from "@/lib/payment-preferences";
import { PaymentDialog, type PaymentDialogStatus } from "./payment-dialog";

export type PayablePaymentBill = PaymentBill & {
  updatedAt: string;
  payee: NonNullable<PaymentBill["payee"]>;
};

export function isPayablePaymentBill(
  bill: PaymentBill | null | undefined,
): bill is PayablePaymentBill {
  return Boolean(bill?.updatedAt && bill.payee?.id);
}

export function SupplementSerialNumberDialog({
  open,
  onOpenChange,
  billId,
  billUpdatedAt,
  dataSource,
  connectBaseUrl,
  onSuccess,
  onBillRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  billUpdatedAt: string;
  dataSource: DataSource;
  connectBaseUrl: string;
  onSuccess: (bill: PaymentBill) => void;
  onBillRefresh: (bill: PaymentBill | null) => void;
}) {
  const [serialNumber, setSerialNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [unverifiedBillVersion, setUnverifiedBillVersion] = useState<
    string | null
  >(null);
  const submittingRef = useRef(false);
  const billVersion = `${billId}:${billUpdatedAt}`;
  const unverified = unverifiedBillVersion === billVersion;

  async function handleSubmit() {
    if (submittingRef.current || unverified) return;

    const trimmed = serialNumber.trim();

    if (!trimmed) {
      toast.error("请输入支付流水号");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const updatedBill = await supplementBillSerialNumber(
        { billId, serialNumber: trimmed, updatedAt: billUpdatedAt },
        { dataSource, connectBaseUrl },
      );
      toast.success("流水号已补充");
      onOpenChange(false);
      onSuccess(updatedBill);
    } catch (error) {
      let latestBill: PaymentBill;

      try {
        latestBill = await getBill(billId, { dataSource, connectBaseUrl });
      } catch {
        setUnverifiedBillVersion(billVersion);
        onOpenChange(false);
        onBillRefresh(null);
        toast.error("无法确认流水号提交结果，正在刷新订单，请核对后再操作");
        return;
      }

      onOpenChange(false);
      if (latestBill.serialNumber === trimmed) {
        onSuccess(latestBill);
        toast.info("已读取最新支付流水号");
      } else {
        onBillRefresh(latestBill);
        toast.error(
          error instanceof Error
            ? `${error.message}，账单已刷新，请核对后重试`
            : "流水号状态已更新，请核对后重试",
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>补充支付流水号</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            请在支付记录中找到流水号（交易单号），填写后收款人可以核对款项。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <FieldGroup className="px-4 pb-2">
          <Field>
            <FieldLabel htmlFor="serial-number">支付流水号</FieldLabel>
            <Input
              id="serial-number"
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="请输入支付流水号"
            />
          </Field>
        </FieldGroup>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting || unverified}
            onClick={handleSubmit}
          >
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {submitting ? "提交中" : "确认提交"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function PaymentSection({
  open,
  onOpenChange,
  bill,
  dataSource,
  connectBaseUrl,
  onSuccess,
  onBillRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: PayablePaymentBill;
  dataSource: DataSource;
  connectBaseUrl: string;
  onSuccess: (bill: PaymentBill) => void;
  onBillRefresh: (bill: PaymentBill | null) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [dialogStatus, setDialogStatus] =
    useState<PaymentDialogStatus>("loading");
  const [qrCodes, setQrCodes] = useState<
    Partial<Record<PaymentPlatform, string>>
  >({});
  const [qrPayeeId, setQrPayeeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [unverifiedPaymentVersion, setUnverifiedPaymentVersion] = useState<
    string | null
  >(null);
  const payeeId = bill.payee.id;
  const paymentVersion = `${bill.id}:${bill.updatedAt}`;
  const paymentVersionUnverified = unverifiedPaymentVersion === paymentVersion;
  const loadCounterRef = useRef(0);

  async function fetchQrCodes() {
    const generation = ++loadCounterRef.current;

    setDialogStatus("loading");
    setErrorMessage(undefined);

    try {
      const codes: PaymentQrCode[] = await listPaymentQrCodes({
        dataSource,
        connectBaseUrl,
        ownerId: payeeId,
      });

      if (generation !== loadCounterRef.current) return;

      const qrMap: Partial<Record<PaymentPlatform, string>> = {};

      for (const code of codes) {
        qrMap[code.channel] = code.content;
      }

      setQrCodes(qrMap);
      setQrPayeeId(payeeId);
      setDialogStatus("ready");
    } catch (error) {
      if (generation !== loadCounterRef.current) return;
      setQrPayeeId(payeeId);
      setErrorMessage(
        error instanceof Error ? error.message : "获取收款码失败，请稍后重试",
      );
      setDialogStatus("error");
    }
  }

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      void fetchQrCodes();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      loadCounterRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataSource, connectBaseUrl, payeeId]);

  const defaultPlatform: PaymentPlatform = bill.channel ?? "wechat";

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      loadCounterRef.current += 1;
      setQrCodes({});
      setQrPayeeId(null);
      setDialogStatus("loading");
    }

    onOpenChange(nextOpen);
  }

  async function handlePay(platform: PaymentPlatform) {
    if (submittingRef.current || paymentVersionUnverified) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const submittedBill = await payBill(
        { billId: bill.id, channel: platform, updatedAt: bill.updatedAt },
        { dataSource, connectBaseUrl },
      );
      setUnverifiedPaymentVersion(null);
      setDialogStatus("submitted");
      onSuccess(submittedBill);
    } catch (error) {
      let latestBill: PaymentBill;

      try {
        latestBill = await getBill(bill.id, { dataSource, connectBaseUrl });
      } catch {
        setUnverifiedPaymentVersion(paymentVersion);
        handleOpenChange(false);
        onBillRefresh(null);
        toast.error("无法确认支付结果，正在刷新订单，请核对后再操作");
        return;
      }

      if (
        latestBill.status === "submitted" ||
        latestBill.status === "completed"
      ) {
        setUnverifiedPaymentVersion(null);
        toast.info("已读取最新支付状态");
        onSuccess(latestBill);
      } else {
        setUnverifiedPaymentVersion(null);
        handleOpenChange(false);
        onBillRefresh(latestBill);
        toast.error(
          latestBill.status === "unpaid"
            ? "支付确认未完成，账单已刷新，请核对后重试"
            : error instanceof Error
              ? error.message
              : "账单状态已更新，请核对后重试",
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <PaymentDialog
      open={open}
      onOpenChange={handleOpenChange}
      amountCents={bill.amountCents}
      payeeName={bill.payee.name}
      verifyCode={bill.verifyCode}
      qrCodes={qrPayeeId === payeeId ? qrCodes : {}}
      defaultPlatform={defaultPlatform}
      status={
        paymentVersionUnverified
          ? "error"
          : qrPayeeId === payeeId
            ? dialogStatus
            : "loading"
      }
      errorMessage={
        paymentVersionUnverified
          ? "支付结果尚未确认，请重新进入订单查看最新账单。"
          : errorMessage
      }
      submitting={submitting}
      onPay={handlePay}
      onCancelPayment={() => handleOpenChange(false)}
      onRetry={paymentVersionUnverified ? undefined : () => void fetchQrCodes()}
    />
  );
}
