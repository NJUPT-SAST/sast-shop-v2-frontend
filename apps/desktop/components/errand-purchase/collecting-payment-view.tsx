"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiAlipayLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiWechatPayLine,
} from "@remixicon/react";
import {
  compareUpdatedAt,
  latestUpdatedAt,
  mergeCollectingPaymentBills,
  confirmBill,
  getErrandTaskBrief,
  transitionToCompleted,
  type CollectingPaymentBill,
  type CollectingPaymentDetail,
  type DataSource,
} from "@sast-shop/api";
import { formatPrice, getQuantityMismatchLabel } from "@sast-shop/domain";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { PaymentCodeHelp } from "@workspace/ui/components/payment-code-help";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";

import { useTransactionAgreement } from "../transaction-agreement-provider";

export function CollectingPaymentView({
  dataSource,
  connectBaseUrl,
  detail,
  taskId,
  taskUpdatedAt,
  billingNotice = false,
}: {
  dataSource: DataSource;
  connectBaseUrl?: string;
  detail: CollectingPaymentDetail;
  taskId: string;
  taskUpdatedAt: string | null;
  billingNotice?: boolean;
}) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const confirmingRef = useRef(false);
  const completingRef = useRef(false);
  const [bills, setBills] = useState<CollectingPaymentBill[]>(detail.bills);
  const [taskVersion, setTaskVersion] = useState(
    latestUpdatedAt(taskUpdatedAt, detail.taskUpdatedAt),
  );
  const [unverifiedTaskVersion, setUnverifiedTaskVersion] = useState<
    string | null | undefined
  >();
  const [unverifiedBillVersions, setUnverifiedBillVersions] = useState<
    Record<string, string | null>
  >({});
  const taskNeedsVerification =
    unverifiedTaskVersion !== undefined &&
    compareUpdatedAt(taskVersion, unverifiedTaskVersion) <= 0;
  const billNeedsVerification = (bill: CollectingPaymentBill) => {
    const baseline = unverifiedBillVersions[bill.requesterId];
    return (
      Object.hasOwn(unverifiedBillVersions, bill.requesterId) &&
      compareUpdatedAt(bill.billUpdatedAt, baseline) <= 0
    );
  };
  useEffect(() => {
    const incomingVersion = latestUpdatedAt(
      taskUpdatedAt,
      detail.taskUpdatedAt,
    );
    if (compareUpdatedAt(incomingVersion, taskVersion) >= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBills((current) => mergeCollectingPaymentBills(current, detail.bills));
    }
    setTaskVersion((current) => latestUpdatedAt(current, incomingVersion));
  }, [detail.bills, detail.taskUpdatedAt, taskUpdatedAt, taskVersion]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [billToConfirm, setBillToConfirm] =
    useState<CollectingPaymentBill | null>(null);
  const currentBillToConfirm = billToConfirm
    ? (bills.find((bill) => bill.requesterId === billToConfirm.requesterId) ??
      null)
    : null;
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [expandedBillKey, setExpandedBillKey] = useState<string | null>(null);
  const confirmedCount = bills.filter(
    (bill) => bill.paymentStatus === "confirmed",
  ).length;
  const totalCount = bills.length;
  const allConfirmed =
    totalCount > 0 &&
    bills.every(
      (bill) =>
        bill.paymentStatus === "confirmed" && !billNeedsVerification(bill),
    );
  const totalAmount = bills.reduce(
    (total, bill) => total + bill.totalAmountCents,
    0,
  );
  const serviceOptions = { dataSource, connectBaseUrl };
  const abnormalBills = bills.filter(
    (bill) =>
      bill.paymentStatus === "closed" || bill.paymentStatus === "unknown",
  );
  const billGroups = [
    {
      key: "pending_confirmation",
      title: "待确认",
      description: "买家已提交支付信息，请核对实际到账记录。",
      bills: bills.filter(
        (bill) => bill.paymentStatus === "pending_confirmation",
      ),
    },
    {
      key: "pending",
      title: "未支付",
      description: "等待买家完成付款并提交支付信息。",
      bills: bills.filter((bill) => bill.paymentStatus === "pending"),
    },
    {
      key: "confirmed",
      title: "已收款",
      description: "已经核对并确认到账的账单。",
      bills: bills.filter((bill) => bill.paymentStatus === "confirmed"),
    },
  ];

  async function confirmPayment(bill: CollectingPaymentBill) {
    if (
      bill.paymentStatus !== "pending_confirmation" ||
      billNeedsVerification(bill) ||
      taskNeedsVerification ||
      completingRef.current
    )
      return;
    if (!bill.billId || !bill.billUpdatedAt || confirmingRef.current) {
      if (!bill.billId || !bill.billUpdatedAt)
        toast.error("账单版本信息缺失，请刷新任务");
      return;
    }
    if (!(await ensureAgreement(() => setBillToConfirm(null)))) return;
    if (
      confirmingRef.current ||
      completingRef.current ||
      taskNeedsVerification ||
      billNeedsVerification(bill)
    )
      return;
    confirmingRef.current = true;
    setConfirmingId(bill.requesterId);
    try {
      const updatedBill = await confirmBill(
        { billId: bill.billId, updatedAt: bill.billUpdatedAt },
        serviceOptions,
      );
      setBills((current) =>
        current.map((candidate) =>
          candidate.requesterId === bill.requesterId
            ? {
                ...candidate,
                paymentStatus: "confirmed",
                billUpdatedAt: latestUpdatedAt(
                  candidate.billUpdatedAt,
                  updatedBill.updatedAt,
                ),
              }
            : candidate,
        ),
      );
      setBillToConfirm(null);
      toast.success("已确认到账");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "确认收款失败，请刷新账单后重试",
      );
      setUnverifiedBillVersions((current) => ({
        ...current,
        [bill.requesterId]: bill.billUpdatedAt,
      }));
      setBillToConfirm(null);
      router.refresh();
    } finally {
      confirmingRef.current = false;
      setConfirmingId(null);
    }
  }

  async function completeTask() {
    if (
      !allConfirmed ||
      completingRef.current ||
      confirmingRef.current ||
      taskNeedsVerification
    )
      return;
    if (!(await ensureAgreement(() => setCompleteOpen(false)))) return;
    if (completingRef.current || confirmingRef.current || taskNeedsVerification)
      return;
    completingRef.current = true;
    setCompleting(true);
    let attemptedTransition = false;
    let attemptedVersion = taskVersion;
    try {
      const latestTask = await getErrandTaskBrief(taskId, serviceOptions);
      setTaskVersion((current) =>
        latestUpdatedAt(current, latestTask?.updatedAt ?? null),
      );
      if (latestTask?.status === "completed") {
        toast.success("订单已完成");
        setCompleteOpen(false);
        router.replace("/orders?type=errand&view=captain");
        return;
      }
      if (latestTask?.status === "collecting_payment") {
        attemptedVersion = latestTask.updatedAt ?? taskVersion;
        attemptedTransition = true;
        await transitionToCompleted(taskId, attemptedVersion, serviceOptions);
        toast.success("订单已完成");
        setCompleteOpen(false);
        router.replace("/orders?type=errand&view=captain");
        return;
      }
      toast.error("任务状态已变化，请刷新后重试");
      setCompleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "订单完成失败，请刷新账单后重试",
      );
      if (attemptedTransition) setUnverifiedTaskVersion(attemptedVersion);
      setCompleteOpen(false);
      router.refresh();
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-2">
            <Link href="/orders?type=errand&view=captain">
              <RiArrowLeftLine data-icon="inline-start" />
              返回任务列表
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">支付核对</h1>
          </div>
        </div>
      </section>

      {billingNotice ? (
        <Alert>
          <AlertTitle>账单生成异常</AlertTitle>
          <AlertDescription>请刷新或联系处理。</AlertDescription>
        </Alert>
      ) : null}

      {taskNeedsVerification || bills.some(billNeedsVerification) ? (
        <Alert>
          <AlertTitle>收款状态待核实</AlertTitle>
          <AlertDescription>
            请重新进入任务，核对最新账单状态后再操作。
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 p-5">
          <Metric
            label={`共 ${totalCount} 笔账单`}
            value={`${confirmedCount}/${totalCount} 人已收款`}
          />
          <Metric
            label="账单总额"
            value={formatPrice(totalAmount)}
            emphasized
          />
        </CardContent>
      </Card>

      {billGroups.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <p className="text-sm text-muted-foreground">
                {group.description}
              </p>
            </div>
            <Badge variant="neutral">{group.bills.length} 笔</Badge>
          </div>
          {group.bills.length ? (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {group.bills.map((bill) => {
                const billKey = bill.billId ?? bill.requesterId;
                return (
                  <BillCard
                    key={billKey}
                    bill={bill}
                    expanded={expandedBillKey === billKey}
                    confirming={confirmingId === bill.requesterId}
                    confirmDisabled={
                      taskNeedsVerification ||
                      billNeedsVerification(bill) ||
                      completing ||
                      confirmingId !== null
                    }
                    onToggle={() =>
                      setExpandedBillKey((current) =>
                        current === billKey ? null : billKey,
                      )
                    }
                    onConfirm={() => setBillToConfirm(bill)}
                  />
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                当前没有{group.title}账单。
              </CardContent>
            </Card>
          )}
        </section>
      ))}

      {abnormalBills.length ? (
        <Alert>
          <AlertTitle>异常账单</AlertTitle>
          <AlertDescription>
            {abnormalBills
              .map(
                (bill) => bill.requesterName || bill.billNo || bill.requesterId,
              )
              .join("、")}
            的账单状态不计入订单完成进度，请刷新后核对。
          </AlertDescription>
        </Alert>
      ) : null}

      {bills.length ? (
        <Card className="sticky bottom-4 z-10 border-primary/20 shadow-lg">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm text-muted-foreground">账单处理进度</p>
              <p className="mt-1 font-semibold tabular-nums">
                {confirmedCount}/{totalCount} 人已收款
              </p>
            </div>
            <Button
              disabled={
                !allConfirmed || taskNeedsVerification || confirmingId !== null
              }
              onClick={() => setCompleteOpen(true)}
            >
              <RiCheckboxCircleLine data-icon="inline-start" />
              订单完成
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={completeOpen}
        onOpenChange={(open) => !completing && setCompleteOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>订单完成</DialogTitle>
            <DialogDescription>
              {confirmedCount}/{totalCount} 人已确认到账。完成后不可继续修改。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={completing}
              onClick={() => setCompleteOpen(false)}
            >
              返回检查
            </Button>
            <Button
              disabled={completing || !allConfirmed || taskNeedsVerification}
              onClick={completeTask}
            >
              {completing ? <Spinner /> : null}订单完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={currentBillToConfirm !== null}
        onOpenChange={(open) =>
          !open && !confirmingRef.current && setBillToConfirm(null)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认这笔款项已到账？</DialogTitle>
            <DialogDescription>
              这是不可逆的财务确认，请与实际收款记录逐项核对。
            </DialogDescription>
          </DialogHeader>
          {currentBillToConfirm ? (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
              <dt className="text-muted-foreground">付款人</dt>
              <dd className="truncate text-right font-medium">
                {currentBillToConfirm.requesterName}
              </dd>
              <dt className="text-muted-foreground">金额</dt>
              <dd className="text-right font-semibold text-primary">
                {formatPrice(currentBillToConfirm.totalAmountCents)}
              </dd>
              {currentBillToConfirm.billNo ? (
                <>
                  <dt className="text-muted-foreground">账单号</dt>
                  <dd className="truncate text-right font-mono text-xs">
                    {currentBillToConfirm.billNo}
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">支付平台</dt>
              <dd className="text-right">
                <PaymentChannelDisplay
                  channel={currentBillToConfirm.paymentChannel}
                />
              </dd>
              {currentBillToConfirm.serialNumber ? (
                <>
                  <dt className="text-muted-foreground">支付流水号</dt>
                  <dd className="break-all text-right">
                    {currentBillToConfirm.serialNumber}
                  </dd>
                </>
              ) : null}
              {currentBillToConfirm.verifyCode ? (
                <>
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    付款标识码
                    <PaymentCodeHelp />
                  </dt>
                  <dd className="text-right font-mono font-semibold tracking-widest">
                    {currentBillToConfirm.verifyCode}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={confirmingId !== null}
              onClick={() => setBillToConfirm(null)}
            >
              返回检查
            </Button>
            <Button
              disabled={
                !currentBillToConfirm ||
                confirmingId !== null ||
                taskNeedsVerification ||
                (currentBillToConfirm &&
                  billNeedsVerification(currentBillToConfirm))
              }
              onClick={() =>
                currentBillToConfirm &&
                void confirmPayment(currentBillToConfirm)
              }
            >
              {confirmingId !== null ? <Spinner /> : null}确认收款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatPaymentChannel(
  channel: CollectingPaymentBill["paymentChannel"],
): string {
  if (channel === "wechat") return "微信支付";
  if (channel === "alipay") return "支付宝";
  return "未提供";
}

function PaymentChannelDisplay({
  channel,
}: {
  channel: CollectingPaymentBill["paymentChannel"];
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {channel === "wechat" ? (
        <RiWechatPayLine aria-hidden="true" className="size-4 text-[#07c160]" />
      ) : channel === "alipay" ? (
        <RiAlipayLine aria-hidden="true" className="size-4 text-[#1677ff]" />
      ) : null}
      {formatPaymentChannel(channel)}
    </span>
  );
}

function PaymentItemBreakdown({
  item,
}: {
  item: CollectingPaymentBill["items"][number];
}) {
  const mismatchLabel = getQuantityMismatchLabel(item);

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">{item.title}</p>
        {mismatchLabel ? (
          <Badge variant="warning" className="shrink-0">
            {mismatchLabel}
          </Badge>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
        <div className="rounded-md bg-background px-2 py-2">
          <dt className="text-muted-foreground">需求</dt>
          <dd className="mt-1 font-medium">{item.requiredQuantity}</dd>
        </div>
        <div className="rounded-md bg-background px-2 py-2">
          <dt className="text-muted-foreground">采购</dt>
          <dd className="mt-1 font-medium">{item.purchasedQuantity}</dd>
        </div>
        <div className="rounded-md bg-background px-2 py-2">
          <dt className="text-muted-foreground">分发</dt>
          <dd className="mt-1 font-medium">{item.distributedQuantity}</dd>
        </div>
      </dl>
      <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm tabular-nums">
        <dt className="text-muted-foreground">实际单价</dt>
        <dd className="text-right">{formatPrice(item.actualUnitPriceCents)}</dd>
        <dt className="text-muted-foreground">商品金额</dt>
        <dd className="text-right">{formatPrice(item.productAmountCents)}</dd>
        <dt className="text-muted-foreground">跑腿费</dt>
        <dd className="text-right">
          {formatPrice(item.serviceFeeAmountCents)}
        </dd>
        <dt className="text-muted-foreground">包装费分摊</dt>
        <dd className="text-right">
          {formatPrice(item.packagingFeeShareCents)}
        </dd>
        <dt className="font-medium">小计</dt>
        <dd className="text-right font-semibold">
          {formatPrice(item.subtotalCents)}
        </dd>
      </dl>
      {item.nonPurchaseReason ? (
        <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          未采购原因：{item.nonPurchaseReason}
        </p>
      ) : null}
    </div>
  );
}

function BillCard({
  bill,
  expanded,
  confirming,
  confirmDisabled,
  onToggle,
  onConfirm,
}: {
  bill: CollectingPaymentBill;
  expanded: boolean;
  confirming: boolean;
  confirmDisabled: boolean;
  onToggle: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage
              src={bill.requesterAvatarUrl}
              alt={bill.requesterName}
            />
            <AvatarFallback>
              {bill.requesterName.trim().slice(0, 1) || "用"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {bill.requesterName || bill.billNo || "待核对账单"}
            </CardTitle>
            {bill.billNo || bill.billId ? (
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {bill.billNo || bill.billId}
              </p>
            ) : null}
            {bill.paymentStatus === "pending_confirmation" &&
            bill.verifyCode ? (
              <p className="mt-1 font-mono text-xs font-semibold tracking-widest text-foreground">
                标识码 {bill.verifyCode}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <PaymentStatusBadge status={bill.paymentStatus} />
          <p className="mt-2 text-lg font-semibold text-primary">
            {formatPrice(bill.totalAmountCents)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 border-t pt-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {expanded ? "收起明细" : "查看明细"}
          </Button>
        </div>
        {expanded ? (
          <>
            <div className="grid gap-3">
              {bill.items.map((item) => (
                <PaymentItemBreakdown
                  key={item.errandDemandItemId}
                  item={item}
                />
              ))}
            </div>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">支付平台</dt>
              <dd className="text-right">
                <PaymentChannelDisplay channel={bill.paymentChannel} />
              </dd>
              <dt className="text-muted-foreground">商品费</dt>
              <dd>{formatPrice(bill.productAmountCents)}</dd>
              <dt className="text-muted-foreground">跑腿费</dt>
              <dd>{formatPrice(bill.serviceFeeAmountCents)}</dd>
              <dt className="text-muted-foreground">包装费</dt>
              <dd>{formatPrice(bill.packagingFeeShareCents)}</dd>
            </dl>
          </>
        ) : null}
        {bill.paymentStatus === "pending_confirmation" ? (
          <Button
            className="mt-1"
            disabled={
              confirmDisabled ||
              confirming ||
              !bill.billId ||
              !bill.billUpdatedAt
            }
            onClick={onConfirm}
          >
            {confirming ? <Spinner /> : null}确认收款
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: CollectingPaymentBill["paymentStatus"];
}) {
  if (status === "pending_confirmation")
    return <Badge variant="attention">待确认</Badge>;
  if (status === "pending") return <Badge variant="payment">未支付</Badge>;
  if (status === "confirmed") return <Badge variant="success">已收款</Badge>;
  if (status === "closed") return <Badge variant="neutral">已关闭</Badge>;
  return <Badge variant="neutral">状态异常</Badge>;
}

function Metric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={
          emphasized
            ? "mt-1 text-xl font-semibold text-primary"
            : "mt-1 text-xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
