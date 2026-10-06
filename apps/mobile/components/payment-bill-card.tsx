"use client";

import { RiAlipayLine, RiWechatPayLine } from "@remixicon/react";
import type { PaymentBill } from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { CopyButton } from "@workspace/ui/components/copy-button";
import { PaymentCodeHelp } from "@workspace/ui/components/payment-code-help";

export function PaymentBillCard({
  bill,
  onSupplement,
  submittedMessage = "付款信息已提交，等待收款人核对到账",
}: {
  bill: PaymentBill;
  onSupplement?: () => void;
  submittedMessage?: string;
}) {
  const payeeName = bill.payee?.name?.trim() || "未提供姓名";
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-start justify-between gap-3 p-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-base">支付账单</CardTitle>
          <div className="flex min-w-0 items-center gap-1">
            <CardDescription className="min-w-0 truncate font-mono tabular-nums">
              {bill.billNo || bill.id}
            </CardDescription>
            <CopyButton value={bill.billNo || String(bill.id)} label="账单号" />
          </div>
        </div>
        <Badge variant={getBillBadgeVariant(bill.status)}>
          {getBillStatusLabel(bill.status)}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <dl className="grid auto-rows-[minmax(2rem,auto)] grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
          {bill.payee?.name ? (
            <>
              <dt className="text-muted-foreground">收款人</dt>
              <dd className="flex min-w-0 items-center justify-end gap-2 font-medium">
                <Avatar className="size-6" aria-hidden="true">
                  <AvatarImage src={bill.payee.avatarUrl || undefined} alt="" />
                  <AvatarFallback className="text-xs">
                    {Array.from(payeeName)[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 break-all text-right">
                  {payeeName}
                </span>
              </dd>
            </>
          ) : null}
          {bill.verifyCode ? (
            <>
              <dt className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
                付款标识码
                <PaymentCodeHelp presentation="drawer" />
              </dt>
              <dd className="flex min-w-0 items-center justify-end gap-1 font-mono font-semibold">
                <span className="break-all text-right">{bill.verifyCode}</span>
                <CopyButton value={bill.verifyCode} label="付款标识码" />
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">账单金额</dt>
          <dd className="text-right font-semibold">
            {formatPrice(bill.amountCents)}
          </dd>
          {bill.channel ? (
            <>
              <dt className="text-muted-foreground">支付方式</dt>
              <dd className="flex items-center justify-end gap-1.5 text-right">
                {bill.channel === "wechat" ? (
                  <RiWechatPayLine
                    className="size-4 text-[#07c160]"
                    aria-hidden="true"
                  />
                ) : (
                  <RiAlipayLine
                    className="size-4 text-[#1677ff]"
                    aria-hidden="true"
                  />
                )}
                {bill.channel === "wechat" ? "微信支付" : "支付宝"}
              </dd>
            </>
          ) : null}
          {bill.serialNumber ? (
            <>
              <dt className="text-muted-foreground">支付流水号</dt>
              <dd className="break-all text-right font-mono">
                {bill.serialNumber}
              </dd>
            </>
          ) : null}
        </dl>
        {bill.status === "submitted" ? (
          <p className="mt-2 border-t pt-2 text-sm text-muted-foreground">
            {submittedMessage}
          </p>
        ) : null}
        {onSupplement ? (
          <Button
            type="button"
            variant="plain"
            size="touch"
            className="mt-2 h-auto min-h-0 px-0 py-0 text-sm leading-5"
            onClick={onSupplement}
          >
            忘记备注？补充流水号
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getBillStatusLabel(status: PaymentBill["status"]): string {
  if (status === "unpaid") return "待支付";
  if (status === "submitted") return "待确认收款";
  if (status === "completed") return "已完成";
  if (status === "closed") return "已关闭";
  return "状态异常";
}

function getBillBadgeVariant(status: PaymentBill["status"]) {
  if (status === "unpaid") return "payment" as const;
  if (status === "submitted") return "attention" as const;
  if (status === "completed") return "success" as const;
  if (status === "closed") return "danger" as const;
  return "neutral" as const;
}
