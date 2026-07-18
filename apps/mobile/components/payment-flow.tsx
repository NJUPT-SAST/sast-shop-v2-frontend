"use client";

import { useEffect, useRef, useState } from "react";
import {
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  billUpdatedAt: string;
  dataSource: DataSource;
  connectBaseUrl: string;
  onSuccess: (bill: PaymentBill) => void;
}) {
  const [serialNumber, setSerialNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit() {
    if (submittingRef.current) return;

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
    } catch {
      toast.error("提交失败，请稍后再试");
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
          <Button type="button" disabled={submitting} onClick={handleSubmit}>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: PayablePaymentBill;
  dataSource: DataSource;
  connectBaseUrl: string;
  onSuccess: (bill: PaymentBill) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [dialogStatus, setDialogStatus] =
    useState<PaymentDialogStatus>("loading");
  const [qrCodes, setQrCodes] = useState<
    Partial<Record<PaymentPlatform, string>>
  >({});
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const payeeId = bill.payee.id;
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
      setDialogStatus("ready");
    } catch {
      if (generation !== loadCounterRef.current) return;
      setErrorMessage("获取收款码失败，请稍后重试");
      setDialogStatus("error");
    }
  }

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      void fetchQrCodes();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataSource, connectBaseUrl, payeeId]);

  const defaultPlatform: PaymentPlatform = bill.channel ?? "wechat";

  async function handlePay(platform: PaymentPlatform) {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const submittedBill = await payBill(
        { billId: bill.id, channel: platform, updatedAt: bill.updatedAt },
        { dataSource, connectBaseUrl },
      );
      setDialogStatus("submitted");
      onSuccess(submittedBill);
    } catch {
      toast.error("提交支付失败，账单可能已更新，请刷新后重试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <PaymentDialog
      open={open}
      onOpenChange={onOpenChange}
      amountCents={bill.amountCents}
      verifyCode={bill.verifyCode}
      qrCodes={qrCodes}
      defaultPlatform={defaultPlatform}
      status={dialogStatus}
      errorMessage={errorMessage}
      submitting={submitting}
      onPay={handlePay}
      onCancelPayment={() => onOpenChange(false)}
      onRetry={() => void fetchQrCodes()}
    />
  );
}
