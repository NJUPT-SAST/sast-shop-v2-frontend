"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowDownSLine, RiArrowUpSLine, RiBillLine } from "@remixicon/react";
import {
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
import { Empty } from "@workspace/ui/components/empty";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { toast } from "sonner";

import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export type CollectingPaymentViewProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  detail: CollectingPaymentDetail;
  taskId: string;
  taskUpdatedAt: string | null;
  billingNotice?: boolean;
};

type DialogState =
  | { type: "none" }
  | { type: "confirm_bill"; bill: CollectingPaymentBill }
  | { type: "confirm_complete" };

function getStatusBadge(status: CollectingPaymentBill["paymentStatus"]) {
  switch (status) {
    case "pending_confirmation":
      return <Badge className="shrink-0">待确认</Badge>;
    case "pending":
      return (
        <Badge variant="secondary" className="shrink-0">
          未支付
        </Badge>
      );
    case "confirmed":
      return (
        <Badge variant="outline" className="shrink-0">
          已收款
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="outline" className="shrink-0">
          已关闭
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="shrink-0">
          状态异常
        </Badge>
      );
  }
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

function formatPaymentChannel(
  channel: CollectingPaymentBill["paymentChannel"],
): string {
  if (channel === "wechat") return "微信支付";
  if (channel === "alipay") return "支付宝";
  return "未选择";
}

export function CollectingPaymentView({
  dataSource,
  connectBaseUrl,
  detail,
  taskId,
  taskUpdatedAt,
  billingNotice = false,
}: CollectingPaymentViewProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const confirmingRef = useRef(false);
  const [bills, setBills] = useState<CollectingPaymentBill[]>(detail.bills);
  const [expandedBillKey, setExpandedBillKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmingBillId, setConfirmingBillId] = useState<string | null>(null);
  const billToConfirm = dialog.type === "confirm_bill" ? dialog.bill : null;

  const serviceOptions = { dataSource, connectBaseUrl };

  const pendingConfirmation = bills.filter(
    (b) => b.paymentStatus === "pending_confirmation",
  );
  const unpaid = bills.filter((b) => b.paymentStatus === "pending");
  const confirmed = bills.filter((b) => b.paymentStatus === "confirmed");
  const abnormalBills = bills.filter(
    (b) => b.paymentStatus === "closed" || b.paymentStatus === "unknown",
  );

  const confirmedCount = confirmed.length;
  const totalCount = bills.length;
  const allConfirmed =
    totalCount > 0 && bills.every((b) => b.paymentStatus === "confirmed");

  const updateBill = (
    requesterId: string,
    status: CollectingPaymentBill["paymentStatus"],
  ) => {
    setBills((prev) =>
      prev.map((b) =>
        b.requesterId === requesterId ? { ...b, paymentStatus: status } : b,
      ),
    );
  };

  const handleConfirmBill = async (bill: CollectingPaymentBill) => {
    if (!bill.billId) {
      toast.error("账单 ID 不存在");
      return;
    }
    if (!bill.billUpdatedAt) {
      toast.error("账单状态已过期，请刷新后重试");
      return;
    }
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmingBillId(bill.requesterId);
    try {
      await confirmBill(
        { billId: bill.billId, updatedAt: bill.billUpdatedAt },
        serviceOptions,
      );
      updateBill(bill.requesterId, "confirmed");
      setDialog({ type: "none" });
      toast.success("已确认到账");
    } catch {
      toast.error("确认收款失败，请稍后再试");
    } finally {
      confirmingRef.current = false;
      setConfirmingBillId(null);
    }
  };

  const handleComplete = async () => {
    if (!allConfirmed || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const latestTask = await getErrandTaskBrief(taskId, serviceOptions);
      if (latestTask?.status === "completed") {
        setDialog({ type: "none" });
        router.replace("/orders?type=errand&view=captain");
        return;
      }
      if (latestTask?.status === "collecting_payment") {
        await transitionToCompleted(
          taskId,
          latestTask.updatedAt ?? taskUpdatedAt,
          serviceOptions,
        );
        setDialog({ type: "none" });
        router.replace("/orders?type=errand&view=captain");
        return;
      }
      toast.error("任务状态已变化，请刷新后重试");
      setDialog({ type: "none" });
      setSubmitting(false);
      router.refresh();
    } catch {
      toast.error("订单完成失败，请刷新账单后重试");
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  const renderBillSection = (list: CollectingPaymentBill[], title: string) => {
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {list.length} 位买家
          </span>
        </div>
        {list.length ? (
          <div className="flex flex-col gap-3">
            {list.map((bill) => {
              const expandKey = bill.billId ?? bill.requesterId;
              const isExpanded = expandedBillKey === expandKey;
              return (
                <div
                  key={expandKey}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <button
                    type="button"
                    aria-controls={`payment-bill-${expandKey}`}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      setExpandedBillKey(isExpanded ? null : expandKey)
                    }
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage
                        src={bill.requesterAvatarUrl}
                        alt={bill.requesterName}
                      />
                      <AvatarFallback className="text-sm">
                        {bill.requesterName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {bill.requesterName}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-primary">
                        {formatPrice(bill.totalAmountCents)}
                      </p>
                      {bill.paymentStatus === "pending_confirmation" &&
                      bill.verifyCode ? (
                        <p className="mt-0.5 font-mono text-xs font-semibold tracking-widest">
                          标识码 {bill.verifyCode}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {getStatusBadge(bill.paymentStatus)}
                      {isExpanded ? (
                        <RiArrowUpSLine className="size-4 text-muted-foreground" />
                      ) : (
                        <RiArrowDownSLine className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      id={`payment-bill-${expandKey}`}
                      className="border-t px-3 pb-3"
                    >
                      <div className="mt-3 flex flex-col gap-3 tabular-nums">
                        {bill.items.map((item) => (
                          <PaymentItemBreakdown
                            key={item.errandDemandItemId}
                            item={item}
                          />
                        ))}
                        <div className="mt-1 border-t pt-2 flex flex-col gap-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              商品费
                            </span>
                            <span>{formatPrice(bill.productAmountCents)}</span>
                          </div>
                          {bill.serviceFeeAmountCents > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                跑腿费
                              </span>
                              <span>
                                {formatPrice(bill.serviceFeeAmountCents)}
                              </span>
                            </div>
                          )}
                          {bill.packagingFeeShareCents > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                包装费
                              </span>
                              <span>
                                {formatPrice(bill.packagingFeeShareCents)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold">
                            <span>合计</span>
                            <span className="text-primary">
                              {formatPrice(bill.totalAmountCents)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {bill.paymentStatus === "pending_confirmation" && (
                        <div className="mt-3">
                          <Button
                            type="button"
                            size="touch"
                            className="w-full"
                            onClick={() =>
                              setDialog({ type: "confirm_bill", bill })
                            }
                            disabled={
                              confirmingBillId === bill.requesterId ||
                              !bill.billId ||
                              !bill.billUpdatedAt
                            }
                          >
                            {confirmingBillId === bill.requesterId
                              ? "处理中"
                              : "确认收款"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
            当前没有{title}账单。
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-5 pb-24">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold leading-7">支付核对</h1>
        <Badge variant="warning">收款中</Badge>
      </div>

      {billingNotice ? (
        <Alert>
          <AlertTitle>账单生成异常</AlertTitle>
          <AlertDescription>请刷新或联系处理。</AlertDescription>
        </Alert>
      ) : null}

      {renderBillSection(pendingConfirmation, "待确认")}
      {renderBillSection(unpaid, "未支付")}
      {renderBillSection(confirmed, "已收款")}

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

      {bills.length === 0 && (
        <Empty
          className="my-auto"
          icon={<RiBillLine className="size-5" />}
          title="暂无账单"
        />
      )}

      {bills.length > 0 ? (
        <MobileFixedFooter>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">账单处理进度</p>
            <p className="text-sm font-semibold tabular-nums">
              {confirmedCount}/{totalCount} 人已收款
            </p>
          </div>
          <Button
            type="button"
            disabled={!allConfirmed}
            className="h-12 flex-1"
            onClick={() => setDialog({ type: "confirm_complete" })}
          >
            订单完成
          </Button>
        </MobileFixedFooter>
      ) : null}

      <ResponsiveDialog
        open={billToConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !confirmingRef.current) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent
          className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm"
          showCloseButton={confirmingBillId === null}
        >
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认这笔款项已到账？</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              这是不可逆的财务确认，请与实际收款记录逐项核对。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {billToConfirm ? (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
              <dt className="text-muted-foreground">付款人</dt>
              <dd className="truncate text-right font-medium">
                {billToConfirm.requesterName}
              </dd>
              <dt className="text-muted-foreground">金额</dt>
              <dd className="text-right font-semibold text-primary">
                {formatPrice(billToConfirm.totalAmountCents)}
              </dd>
              {billToConfirm.billNo ? (
                <>
                  <dt className="text-muted-foreground">账单号</dt>
                  <dd className="truncate text-right font-mono text-xs">
                    {billToConfirm.billNo}
                  </dd>
                </>
              ) : null}
              {billToConfirm.paymentChannel ? (
                <>
                  <dt className="text-muted-foreground">支付渠道</dt>
                  <dd className="text-right">
                    {formatPaymentChannel(billToConfirm.paymentChannel)}
                  </dd>
                </>
              ) : null}
              {billToConfirm.serialNumber ? (
                <>
                  <dt className="text-muted-foreground">支付流水号</dt>
                  <dd className="break-all text-right">
                    {billToConfirm.serialNumber}
                  </dd>
                </>
              ) : null}
              {billToConfirm.verifyCode ? (
                <>
                  <dt className="text-muted-foreground">付款标识码</dt>
                  <dd className="text-right font-mono font-semibold tracking-widest">
                    {billToConfirm.verifyCode}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={confirmingBillId !== null}
              onClick={() => setDialog({ type: "none" })}
            >
              返回检查
            </Button>
            <Button
              type="button"
              disabled={!billToConfirm || confirmingBillId !== null}
              onClick={() =>
                billToConfirm && void handleConfirmBill(billToConfirm)
              }
            >
              {confirmingBillId !== null ? "确认中" : "确认收款"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "confirm_complete"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认订单完成</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {confirmedCount}/{totalCount} 人已确认到账。完成后不可继续修改。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setDialog({ type: "none" })}
            >
              返回
            </Button>
            <Button
              type="button"
              disabled={submitting || !allConfirmed}
              onClick={() => void handleComplete()}
            >
              {submitting ? "处理中" : "订单完成"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
