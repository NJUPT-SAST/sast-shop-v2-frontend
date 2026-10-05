"use client";

import { useTransactionAgreement } from "./transaction-agreement-provider";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiFileList3Line,
  RiTimeLine,
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
import { toast } from "sonner";

import type { SpotOrderView } from "@/lib/order-filters";
import { resolveOrderContactAction } from "@/lib/order-contact";
import {
  hasPaymentRecipient,
  reconcileSpotOrderUpdate,
  resolveSpotOrderActions,
} from "@/lib/spot-order-actions";
import { ManagedImage } from "./managed-image";
import {
  LarkContactButton,
  useLarkContactAvailability,
} from "./lark-contact-button";
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
export function SpotOrderDetail({
  dataSource,
  connectBaseUrl,
  order,
  view,
}: SpotOrderDetailProps) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] =
    useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [unverifiedPaymentBillVersion, setUnverifiedPaymentBillVersion] =
    useState<string | null>(null);
  const [unverifiedSupplementBillVersion, setUnverifiedSupplementBillVersion] =
    useState<string | null>(null);
  const [lifecyclePending, setLifecyclePending] = useState<
    "cancel" | "complete" | "confirm-payment" | null
  >(null);
  const lifecyclePendingRef = useRef(false);

  const resolvedOrder = reconcileSpotOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const isCancelled = resolvedOrder.status === "cancelled";
  const actions = resolveSpotOrderActions(
    view,
    resolvedOrder.status,
    bill?.status,
  );
  const versionedBill: VersionedPaymentBill | null = bill?.updatedAt
    ? { ...bill, updatedAt: bill.updatedAt }
    : null;
  const paymentBillVersion = versionedBill
    ? `${versionedBill.id}:${versionedBill.updatedAt}`
    : null;
  const paymentVersionUnverified =
    paymentBillVersion !== null &&
    paymentBillVersion === unverifiedPaymentBillVersion;
  const supplementBillVersion = versionedBill
    ? `${versionedBill.id}:${versionedBill.updatedAt}`
    : null;
  const supplementVersionUnverified =
    supplementBillVersion !== null &&
    supplementBillVersion === unverifiedSupplementBillVersion;
  const payableBill: PayablePaymentBill | null =
    versionedBill && hasPaymentRecipient(versionedBill) ? versionedBill : null;
  const canSubmitPayment =
    actions.canPay && Boolean(payableBill) && !paymentVersionUnverified;
  const canSupplementSerialNumber =
    actions.canSupplementSerialNumber &&
    Boolean(versionedBill) &&
    !supplementVersionUnverified;
  const canConfirmPayment = actions.canConfirmPayment && Boolean(versionedBill);
  const feishuUiEnvironment = useLarkContactAvailability();
  const contactAction = resolveOrderContactAction({
    orderType: "spot",
    view,
    isFeishuEnvironment: feishuUiEnvironment,
  });
  const canContactSeller = Boolean(contactAction);
  const showActionBar =
    canContactSeller ||
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
    if (
      !(await ensureAgreement(() => {
        setCancelDialogOpen(false);
        setCompleteDialogOpen(false);
        setConfirmPaymentDialogOpen(false);
      })) ||
      lifecyclePendingRef.current
    )
      return;

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
    } catch (error) {
      setCancelDialogOpen(false);
      setCompleteDialogOpen(false);
      setConfirmPaymentDialogOpen(false);
      router.refresh();
      toast.error(
        error instanceof Error
          ? `${error.message}，正在刷新订单状态`
          : "操作结果未确认，正在刷新订单状态",
      );
    } finally {
      lifecyclePendingRef.current = false;
      setLifecyclePending(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-2 py-3">
        <h1 className="text-lg font-semibold">订单详情</h1>

        <OrderTimelinePanel
          order={resolvedOrder}
          currentLabel={currentStatusLabel}
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
        />

        <OrderInfoCard order={resolvedOrder} view={view} />
        {bill ? <BillCard bill={bill} /> : null}
        {paymentVersionUnverified ? (
          <Alert>
            <AlertTitle>支付结果待确认</AlertTitle>
            <AlertDescription>
              请重新进入订单查看最新账单后再操作。
            </AlertDescription>
          </Alert>
        ) : null}
        {supplementVersionUnverified ? (
          <Alert>
            <AlertTitle>流水号状态待确认</AlertTitle>
            <AlertDescription>
              请重新进入订单查看最新账单后再操作。
            </AlertDescription>
          </Alert>
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
          {contactAction ? (
            <LarkContactButton
              target={contactAction.target}
              orderId={String(resolvedOrder.id)}
              dataSource={dataSource}
              connectBaseUrl={connectBaseUrl}
              label={contactAction.label}
              iconOnly
              className="shrink-0"
            />
          ) : null}
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
              onClick={() =>
                void ensureAgreement().then((agreed) => {
                  if (agreed) setPaymentDrawerOpen(true);
                })
              }
            >
              去支付
            </Button>
          ) : null}
          {canSupplementSerialNumber ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() =>
                void ensureAgreement().then((agreed) => {
                  if (agreed) setSupplementOpen(true);
                })
              }
            >
              补充流水号
            </Button>
          ) : null}
          {canConfirmPayment ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() =>
                void ensureAgreement().then((agreed) => {
                  if (agreed) setConfirmPaymentDialogOpen(true);
                })
              }
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

      {canSubmitPayment && payableBill ? (
        <PaymentSection
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          bill={payableBill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={(submittedBill) => {
            setUnverifiedPaymentBillVersion(null);
            setCurrentOrder({ ...resolvedOrder, bill: submittedBill });
            setPaymentDrawerOpen(false);
            router.refresh();
          }}
          onBillRefresh={(latestBill) => {
            if (latestBill) {
              setUnverifiedPaymentBillVersion(null);
              setCurrentOrder({ ...resolvedOrder, bill: latestBill });
            } else {
              setUnverifiedPaymentBillVersion(paymentBillVersion);
            }
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
            setUnverifiedSupplementBillVersion(null);
            setCurrentOrder({ ...resolvedOrder, bill: updatedBill });
            setSupplementOpen(false);
            router.refresh();
          }}
          onBillRefresh={(latestBill) => {
            if (latestBill) {
              setUnverifiedSupplementBillVersion(null);
              setCurrentOrder({ ...resolvedOrder, bill: latestBill });
            } else {
              setUnverifiedSupplementBillVersion(supplementBillVersion);
            }
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
        description={
          bill?.verifyCode
            ? `请核对付款标识码 ${bill.verifyCode} 和到账金额 ${formatPrice(bill.amountCents)}，确认实际到账后再继续。`
            : `请核对到账金额 ${formatPrice(bill?.amountCents ?? resolvedOrder.totalAmountCents)}，确认实际到账后再继续。`
        }
        confirmLabel="确认已到账"
        pending={lifecyclePending === "confirm-payment"}
        onConfirm={() => void handleLifecycleAction("confirm-payment")}
      />
    </div>
  );
}

function OrderTimelinePanel({
  order,
  currentLabel,
  open,
  onOpenChange,
}: {
  order: SpotOrder;
  currentLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const timeline = buildSpotOrderTimeline(order);

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <Button
        type="button"
        variant="ghost"
        className="h-12 w-full justify-between rounded-none px-3 hover:bg-muted/50 aria-expanded:bg-transparent aria-expanded:text-foreground"
        aria-expanded={open}
        aria-controls="spot-order-timeline"
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <RiTimeLine data-icon="inline-start" />
          <span className="truncate">订单节点</span>
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm font-normal text-muted-foreground">
            {currentLabel}
          </span>
          {open ? (
            <RiArrowUpSLine className="size-5 shrink-0 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="size-5 shrink-0 text-muted-foreground" />
          )}
        </span>
      </Button>
      <div
        id="spot-order-timeline"
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t px-3 pt-2">
            {timeline.length === 0 ? (
              <Alert className="mb-3">
                <RiFileList3Line />
                <AlertTitle>暂无订单节点</AlertTitle>
              </Alert>
            ) : (
              timeline.map((item, index) => (
                <div
                  key={`${item.label}-${item.timestamp}`}
                  className="flex gap-3"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {item.kind === "cancelled" ? (
                        <RiCloseCircleLine className="size-4" />
                      ) : (
                        <RiCheckboxCircleLine className="size-4" />
                      )}
                    </span>
                    {index < timeline.length - 1 ? (
                      <span className="min-h-8 w-px flex-1 bg-border" />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-3">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {formatDateTime(item.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildSpotOrderTimeline(order: SpotOrder) {
  const nodes = [
    { label: "创建订单", timestamp: order.createdAt, kind: "created" },
    { label: "完成支付", timestamp: order.paidAt, kind: "paid" },
    { label: "完成订单", timestamp: order.completedAt, kind: "completed" },
    { label: "取消订单", timestamp: order.cancelledAt, kind: "cancelled" },
  ];

  return nodes.filter(
    (node): node is { label: string; timestamp: string; kind: string } =>
      isValidTimestamp(node.timestamp),
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function isValidTimestamp(value: string | null): value is string {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

function getCurrentStatusLabel(
  view: SpotOrderView,
  orderStatus: SpotOrder["status"],
  billStatus?: PaymentBill["status"],
): string {
  if (orderStatus === "completed") return "已完成";
  if (orderStatus === "cancelled") return "已取消";
  if (orderStatus === "unknown") return "状态异常";

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

function OrderInfoCard({
  order,
  view,
}: {
  order: SpotOrder;
  view: SpotOrderView;
}) {
  const lineTotal = order.unitPriceCents * order.quantity;
  const counterparty = view === "seller" ? order.bill?.payer : order.seller;
  const showCounterparty =
    counterparty && counterparty.name !== order.store?.name;

  return (
    <Card className="rounded-lg">
      <CardHeader className="p-3">
        <CardTitle className="text-base">订单信息</CardTitle>
        <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <span className="min-w-0 truncate font-mono tabular-nums">
            {order.orderNo || order.id}
          </span>
          <CopyButton
            value={order.orderNo || String(order.id)}
            label="订单号"
            compact
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3 pt-0">
        {order.store ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">店铺</span>
            <span>{order.store.name}</span>
          </div>
        ) : null}
        {showCounterparty ? (
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

function BillCard({ bill }: { bill: PaymentBill }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-start justify-between gap-3 p-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-base">支付账单</CardTitle>
          <div className="flex min-w-0 items-center gap-1">
            <CardDescription className="min-w-0 truncate font-mono tabular-nums">
              {bill.billNo || bill.id}
            </CardDescription>
            <CopyButton
              value={bill.billNo || String(bill.id)}
              label="账单号"
              compact
            />
          </div>
        </div>
        <Badge variant={getBillBadgeVariant(bill.status)}>
          {getBillStatusLabel(bill.status)}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <dl className="grid auto-rows-[minmax(2rem,auto)] grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
          {bill.payee?.name ? (
            <>
              <dt className="text-muted-foreground">收款人</dt>
              <dd className="min-w-0 truncate text-right">{bill.payee.name}</dd>
            </>
          ) : null}
          {bill.verifyCode ? (
            <>
              <dt className="text-muted-foreground">付款标识码</dt>
              <dd className="flex min-w-0 items-center justify-end gap-1 font-mono font-semibold">
                <span className="break-all text-right">{bill.verifyCode}</span>
                <CopyButton
                  value={bill.verifyCode}
                  label="付款标识码"
                  compact
                />
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
              <dd className="text-right">
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
      </CardContent>
    </Card>
  );
}

function UnavailablePaymentBill() {
  return (
    <Card className="rounded-lg">
      <CardHeader className="p-3">
        <CardTitle className="text-base">账单暂不可支付</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-sm text-muted-foreground">
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
