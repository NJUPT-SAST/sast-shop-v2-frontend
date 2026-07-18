"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiQuestionLine,
} from "@remixicon/react";
import {
  cancelSpotOrder,
  completeSpotOrder,
  confirmBill,
  type DataSource,
  type PaymentBill,
  type SpotOrder,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

import type { SpotOrderView } from "@/lib/order-filters";
import {
  hasPaymentRecipient,
  reconcileSpotOrderUpdate,
  resolveSpotOrderActions,
} from "@/lib/spot-order-actions";
import { ManagedImage } from "./managed-image";
import { MobileFixedFooter } from "./mobile-fixed-footer";
import {
  PaymentSection,
  SupplementSerialNumberDialog,
  type PayablePaymentBill,
} from "./payment-flow";

export type SpotOrderDetailProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  order: SpotOrder;
  view: SpotOrderView;
};

type VersionedPaymentBill = PaymentBill & { updatedAt: string };
type OrderStep = {
  label: string;
  isActive: boolean;
  isDone: boolean;
};

const STATUS_STEP_INDEX: Record<SpotOrder["status"], number> = {
  pending_payment: 0,
  paid: 1,
  completed: 2,
  cancelled: -1,
  unknown: -1,
};

const BUYER_STEP_LABELS = ["待支付", "处理中", "已完成"];
const SELLER_STEP_LABELS = ["待收款", "后续处理", "已完成"];

function buildSteps(
  status: SpotOrder["status"],
  view: SpotOrderView,
): OrderStep[] {
  const activeIndex = STATUS_STEP_INDEX[status];
  const labels = view === "seller" ? SELLER_STEP_LABELS : BUYER_STEP_LABELS;

  return labels.map((label, index) => ({
    label,
    isDone: activeIndex > index,
    isActive: activeIndex === index,
  }));
}

export function SpotOrderDetail({
  dataSource,
  connectBaseUrl,
  order,
  view,
}: SpotOrderDetailProps) {
  const router = useRouter();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [progressDrawerOpen, setProgressDrawerOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] =
    useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [lifecyclePending, setLifecyclePending] = useState<
    "cancel" | "complete" | "confirm-payment" | null
  >(null);
  const lifecyclePendingRef = useRef(false);

  const resolvedOrder = reconcileSpotOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const steps = buildSteps(resolvedOrder.status, view);
  const isCancelled = resolvedOrder.status === "cancelled";
  const actions = resolveSpotOrderActions(
    view,
    resolvedOrder.status,
    bill?.status,
  );
  const versionedBill: VersionedPaymentBill | null = bill?.updatedAt
    ? { ...bill, updatedAt: bill.updatedAt }
    : null;
  const payableBill: PayablePaymentBill | null =
    versionedBill && hasPaymentRecipient(versionedBill) ? versionedBill : null;
  const canSubmitPayment = actions.canPay && Boolean(payableBill);
  const canSupplementSerialNumber =
    actions.canSupplementSerialNumber && Boolean(versionedBill);
  const canConfirmPayment = actions.canConfirmPayment && Boolean(versionedBill);
  const showActionBar =
    actions.canCancel ||
    canSubmitPayment ||
    canSupplementSerialNumber ||
    canConfirmPayment ||
    actions.canComplete;
  const currentStatusLabel = getCurrentStatusLabel(
    view,
    resolvedOrder.status,
    bill?.status,
  );

  async function handleLifecycleAction(
    action: "cancel" | "complete" | "confirm-payment",
  ) {
    if (lifecyclePendingRef.current) return;
    if (action === "confirm-payment" && !versionedBill) return;

    lifecyclePendingRef.current = true;
    setLifecyclePending(action);

    try {
      if (action === "cancel") {
        const updatedOrder = await cancelSpotOrder(
          { spotOrderId: resolvedOrder.id },
          { dataSource, connectBaseUrl },
        );
        setCurrentOrder(updatedOrder);
        setCancelDialogOpen(false);
        toast.success("订单已取消");
      } else if (action === "complete") {
        const updatedOrder = await completeSpotOrder(
          { spotOrderId: resolvedOrder.id },
          { dataSource, connectBaseUrl },
        );
        setCurrentOrder(updatedOrder);
        setCompleteDialogOpen(false);
        toast.success("已确认收货");
      } else {
        const updatedBill = await confirmBill(
          { billId: versionedBill!.id, updatedAt: versionedBill!.updatedAt },
          { dataSource, connectBaseUrl },
        );
        setCurrentOrder({ ...resolvedOrder, bill: updatedBill });
        setConfirmPaymentDialogOpen(false);
        toast.success("已确认收款");
      }

      router.refresh();
    } catch {
      toast.error("操作失败，订单状态可能已更新，请刷新后重试");
    } finally {
      lifecyclePendingRef.current = false;
      setLifecyclePending(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        className={cn(
          "flex flex-1 flex-col gap-4 py-4",
          showActionBar && "pb-24",
        )}
      >
        <h1 className="text-lg font-semibold">订单详情</h1>

        <OrderProgressBar
          steps={steps}
          currentLabel={currentStatusLabel}
          isCancelled={isCancelled}
          onExpand={() => setProgressDrawerOpen(true)}
        />

        <OrderInfoCard order={resolvedOrder} view={view} />

        {resolvedOrder.status === "paid" && bill ? (
          <PaidStatusSection bill={bill} />
        ) : null}

        {view === "buyer" &&
        resolvedOrder.status === "pending_payment" &&
        bill?.status === "submitted" ? (
          <AwaitingPaymentConfirmation bill={bill} />
        ) : null}

        {view === "seller" &&
        resolvedOrder.status === "pending_payment" &&
        bill ? (
          <SellerPaymentReview bill={bill} />
        ) : null}

        {view === "buyer" && actions.canPay && !payableBill ? (
          <UnavailablePaymentBill />
        ) : null}

        {view === "seller" &&
        resolvedOrder.status === "pending_payment" &&
        bill?.status === "completed" ? (
          <Alert>
            <RiCheckboxCircleLine />
            <AlertTitle>收款已确认</AlertTitle>
            <AlertDescription>
              订单状态正在同步，请稍后刷新查看。
            </AlertDescription>
          </Alert>
        ) : null}

        {isCancelled ? (
          <Alert>
            <RiCloseCircleLine />
            <AlertTitle>关联账单已关闭</AlertTitle>
          </Alert>
        ) : null}
      </div>

      {showActionBar ? (
        <MobileFixedFooter>
          {actions.canCancel ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCancelDialogOpen(true)}
            >
              取消订单
            </Button>
          ) : null}
          {canSubmitPayment ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => setPaymentDrawerOpen(true)}
            >
              去支付
            </Button>
          ) : null}
          {canSupplementSerialNumber ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => setSupplementOpen(true)}
            >
              补充流水号
            </Button>
          ) : null}
          {canConfirmPayment ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => setConfirmPaymentDialogOpen(true)}
            >
              确认收款
            </Button>
          ) : null}
          {actions.canComplete ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => setCompleteDialogOpen(true)}
            >
              确认收货
            </Button>
          ) : null}
        </MobileFixedFooter>
      ) : null}

      <OrderProgressDrawer
        open={progressDrawerOpen}
        onOpenChange={setProgressDrawerOpen}
        steps={steps}
        isCancelled={isCancelled}
      />

      {canSubmitPayment && payableBill ? (
        <PaymentSection
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          bill={payableBill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={(submittedBill) => {
            setCurrentOrder({ ...resolvedOrder, bill: submittedBill });
            setPaymentDrawerOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {canSupplementSerialNumber && versionedBill ? (
        <SupplementSerialNumberDialog
          open={supplementOpen}
          onOpenChange={setSupplementOpen}
          billId={versionedBill.id}
          billUpdatedAt={versionedBill.updatedAt}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={(updatedBill) => {
            setCurrentOrder({ ...resolvedOrder, bill: updatedBill });
            setSupplementOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        hasSubmittedPayment={bill?.status === "submitted"}
        pending={lifecyclePending === "cancel"}
        onConfirm={() => void handleLifecycleAction("cancel")}
      />

      <LifecycleConfirmDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        title="确认收货"
        description="确认已经收到商品且无误吗？确认后订单将完成。"
        confirmLabel="确认收货"
        pending={lifecyclePending === "complete"}
        onConfirm={() => void handleLifecycleAction("complete")}
      />

      <LifecycleConfirmDialog
        open={confirmPaymentDialogOpen}
        onOpenChange={setConfirmPaymentDialogOpen}
        title="确认收款"
        description={`请核对标识码 ${bill?.verifyCode ?? "-"} 和到账金额 ${formatPrice(
          bill?.amountCents ?? resolvedOrder.totalAmountCents,
        )}，确认实际到账后再继续。`}
        confirmLabel="确认已到账"
        pending={lifecyclePending === "confirm-payment"}
        onConfirm={() => void handleLifecycleAction("confirm-payment")}
      />
    </div>
  );
}

function OrderProgressBar({
  steps,
  currentLabel,
  isCancelled,
  onExpand,
}: {
  steps: OrderStep[];
  currentLabel: string;
  isCancelled: boolean;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left"
      onClick={onExpand}
    >
      <div className="flex items-center gap-3">
        {isCancelled ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted">
            <RiCloseCircleLine className="size-4 text-muted-foreground" />
          </span>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <RiCheckboxCircleLine className="size-4 text-primary" />
          </span>
        )}
        <div>
          <p className="text-sm font-medium">{currentLabel}</p>
          {!isCancelled ? (
            <p className="text-xs text-muted-foreground">
              {steps.filter((s) => s.isDone || s.isActive).length} /{" "}
              {steps.length} 步骤
            </p>
          ) : null}
        </div>
      </div>
      <RiQuestionLine className="size-4 text-muted-foreground" />
    </button>
  );
}

function OrderProgressDrawer({
  open,
  onOpenChange,
  steps,
  isCancelled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: OrderStep[];
  isCancelled: boolean;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>订单进度</DrawerTitle>
          <DrawerDescription className="sr-only">
            查看现货订单的处理进度
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {isCancelled ? (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                  <RiCloseCircleLine className="size-4 text-muted-foreground" />
                </span>
              </div>
              <p className="pt-0.5 text-sm font-medium text-muted-foreground">
                已取消
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full",
                        step.isDone
                          ? "bg-primary/10 text-primary"
                          : step.isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {step.isDone ? (
                        <RiCheckboxCircleLine className="size-4" />
                      ) : (
                        <span className="text-xs font-semibold">
                          {index + 1}
                        </span>
                      )}
                    </span>
                    {index < steps.length - 1 ? (
                      <span
                        className={cn(
                          "my-1 w-0.5 flex-1",
                          step.isDone ? "bg-primary/30" : "bg-muted",
                        )}
                        style={{ minHeight: "1.5rem" }}
                      />
                    ) : null}
                  </div>
                  <div className="pb-4 pt-0.5">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.isActive
                          ? "text-foreground"
                          : step.isDone
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    {step.isActive ? (
                      <p className="mt-0.5 text-xs text-primary">当前状态</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function getCurrentStatusLabel(
  view: SpotOrderView,
  orderStatus: SpotOrder["status"],
  billStatus?: PaymentBill["status"],
): string {
  if (orderStatus === "completed") return "已完成";
  if (orderStatus === "cancelled") return "已取消";
  if (orderStatus === "unknown") return "未知";

  if (orderStatus === "paid") {
    return view === "seller" ? "后续处理" : "处理中";
  }

  if (view === "seller") {
    if (billStatus === "submitted") return "待确认收款";
    if (billStatus === "completed") return "状态同步中";
    return "等待买家付款";
  }

  return billStatus === "submitted" ? "等待收款确认" : "待支付";
}

function OrderInfoCard({
  order,
  view,
}: {
  order: SpotOrder;
  view: SpotOrderView;
}) {
  const lineTotal = order.unitPriceCents * order.quantity;
  const counterparty = view === "seller" ? order.bill?.payer : order.seller;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">订单信息</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">订单号</span>
          <span className="font-mono text-xs">{order.orderNo}</span>
        </div>
        {order.store ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">店铺</span>
            <span>{order.store.name}</span>
          </div>
        ) : null}
        {counterparty ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {view === "seller" ? "买家" : "卖家"}
            </span>
            <span className="truncate">{counterparty.name}</span>
          </div>
        ) : null}
        <Separator />
        <div className="flex items-start gap-3">
          <ManagedImage
            src={order.productImageUrl}
            alt={order.productTitle}
            className="size-16 shrink-0 rounded-md"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-sm font-medium">{order.productTitle}</p>
            {order.productDescription ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {order.productDescription}
              </p>
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {formatPrice(order.unitPriceCents)} × {order.quantity}
              </span>
              <span className="font-medium">{formatPrice(lineTotal)}</span>
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">合计</span>
          <span className="text-base font-semibold text-primary">
            {formatPrice(order.totalAmountCents)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PaidStatusSection({ bill }: { bill: PaymentBill }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">支付信息</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RiCheckboxCircleLine className="size-4 shrink-0 text-primary" />
          收款方将根据标识码核对收款信息
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm text-muted-foreground">标识码</span>
          <span className="select-all font-mono text-sm font-semibold">
            {bill.verifyCode}
          </span>
        </div>
        {bill.channel ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">支付方式</span>
            <span>{bill.channel === "wechat" ? "微信支付" : "支付宝"}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AwaitingPaymentConfirmation({ bill }: { bill: PaymentBill }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">等待收款确认</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RiCheckboxCircleLine className="size-4 shrink-0 text-primary" />
          已提交支付信息，请等待发布者核对款项。
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm text-muted-foreground">付款标识码</span>
          <span className="font-mono text-sm font-semibold">
            {bill.verifyCode}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SellerPaymentReview({ bill }: { bill: PaymentBill }) {
  if (bill.status === "unpaid") {
    return (
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">等待买家付款</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          买家尚未提交支付信息，到账后再进行收款确认。
        </CardContent>
      </Card>
    );
  }

  if (bill.status !== "submitted") return null;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">核对收款信息</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm text-muted-foreground">付款标识码</span>
          <span className="font-mono text-sm font-semibold">
            {bill.verifyCode}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">支付方式</span>
          <span>
            {bill.channel === "wechat"
              ? "微信支付"
              : bill.channel === "alipay"
                ? "支付宝"
                : "未填写"}
          </span>
        </div>
        {bill.serialNumber ? (
          <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
            <span className="shrink-0 text-muted-foreground">支付流水号</span>
            <span className="min-w-0 break-all text-right font-mono text-xs">
              {bill.serialNumber}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UnavailablePaymentBill() {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">账单暂不可支付</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        账单缺少最新状态或收款方信息，已停止支付。请返回订单列表后重试。
      </CardContent>
    </Card>
  );
}

function CancelOrderDialog({
  open,
  onOpenChange,
  hasSubmittedPayment,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSubmittedPayment: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveDialog forceDrawer open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
        <ResponsiveDialogHeader className="px-0 text-left">
          <ResponsiveDialogTitle>取消订单</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {hasSubmittedPayment
              ? "你已提交付款信息。取消订单不会自动退款，请先与卖家协商退款后再确认取消。"
              : "取消后订单与关联账单将关闭，且无法恢复。确认继续吗？"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            再想想
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "取消中" : "确认取消"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function LifecycleConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveDialog forceDrawer open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
        <ResponsiveDialogHeader className="px-0 text-left">
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            返回核对
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "处理中" : confirmLabel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
