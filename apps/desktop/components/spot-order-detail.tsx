"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
} from "@remixicon/react";
import {
  cancelSpotOrder,
  completeSpotOrder,
  confirmBill,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type DataSource,
  type PaymentQrChannel,
  type SpotOrder,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { CopyButton } from "@workspace/ui/components/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

import {
  getSpotOrderStatusLabel,
  reconcileSpotOrderUpdate,
  resolveSpotOrderActions,
  type SpotOrderView,
} from "@/lib/spot-orders";
import { ManagedImage } from "./managed-image";
import { LarkContactButton } from "./lark-contact-button";
import { useTransactionAgreement } from "./transaction-agreement-provider";

type ConfirmationAction = "cancel" | "complete" | "confirm" | null;

export function SpotOrderDetail({
  dataSource,
  connectBaseUrl,
  order,
  view,
  returnTo,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  order: SpotOrder;
  view: SpotOrderView;
  returnTo: string;
}) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationAction>(null);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const resolvedOrder = reconcileSpotOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const actions = resolveSpotOrderActions(
    view,
    resolvedOrder.status,
    bill?.status,
  );
  const timeline = buildSpotOrderTimeline(resolvedOrder);

  async function mutate(action: Exclude<ConfirmationAction, null>) {
    if (pendingRef.current) return;
    const orderId = resolvedOrder.id;
    const billToConfirm = bill;
    if (!(await ensureAgreement(() => setConfirmation(null)))) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      if (action === "cancel") {
        setCurrentOrder(
          await cancelSpotOrder(
            { spotOrderId: orderId },
            { dataSource, connectBaseUrl },
          ),
        );
        toast.success("订单已取消");
      } else if (action === "complete") {
        setCurrentOrder(
          await completeSpotOrder(
            { spotOrderId: orderId },
            { dataSource, connectBaseUrl },
          ),
        );
        toast.success("订单已完成");
      } else if (billToConfirm?.updatedAt) {
        const updatedBill = await confirmBill(
          { billId: billToConfirm.id, updatedAt: billToConfirm.updatedAt },
          { dataSource, connectBaseUrl },
        );
        setCurrentOrder((value) => ({ ...value, bill: updatedBill }));
        toast.success("已确认收款");
      }
      setConfirmation(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "操作失败，订单状态可能已变化，请刷新后重试",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function supplement() {
    if (!bill?.updatedAt || !serialNumber.trim() || pendingRef.current) return;
    const billToSupplement = bill;
    const billVersion = bill.updatedAt;
    const submittedSerialNumber = serialNumber.trim();
    if (!(await ensureAgreement(() => setSupplementOpen(false)))) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const updatedBill = await supplementBillSerialNumber(
        {
          billId: billToSupplement.id,
          serialNumber: submittedSerialNumber,
          updatedAt: billVersion,
        },
        { dataSource, connectBaseUrl },
      );
      setCurrentOrder((value) => ({ ...value, bill: updatedBill }));
      setSupplementOpen(false);
      toast.success("支付流水号已补充");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "提交失败，请刷新账单状态后重试",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" asChild className="-ml-3 mb-2">
            <Link href={returnTo}>
              <RiArrowLeftLine />
              返回订单
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              订单详情
            </h1>
            <Badge
              variant={
                resolvedOrder.status === "completed"
                  ? "success"
                  : resolvedOrder.status === "cancelled"
                    ? "neutral"
                    : "payment"
              }
            >
              {getSpotOrderStatusLabel(
                view,
                resolvedOrder.status,
                bill?.status,
              )}
            </Badge>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <span className="truncate font-mono tabular-nums">
              {resolvedOrder.orderNo || resolvedOrder.id}
            </span>
            <CopyButton
              value={resolvedOrder.orderNo || String(resolvedOrder.id)}
              label="订单号"
            />
          </div>
        </div>
        {view === "buyer" ? (
          <LarkContactButton
            target="spot-seller"
            orderId={String(resolvedOrder.id)}
            dataSource={dataSource}
            connectBaseUrl={connectBaseUrl}
            label="联系卖家"
          />
        ) : null}
      </div>

      {timeline.length > 0 ? (
        <Card>
          <CardContent className="flex gap-0 overflow-x-auto p-5">
            {timeline.map((node, index) => (
              <div
                key={`${node.label}-${node.timestamp}`}
                className="relative flex min-w-44 flex-1 items-center gap-3 pr-4 last:pr-0"
              >
                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
                  {node.kind === "cancelled" ? (
                    <RiCloseCircleLine className="size-4" />
                  ) : (
                    <RiCheckboxCircleLine className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{node.label}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {formatDate(node.timestamp)}
                  </p>
                </div>
                {index < timeline.length - 1 ? (
                  <span className="absolute left-8 right-0 top-4 h-px bg-primary" />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] items-start gap-5">
        <Card>
          <CardHeader>
            <CardTitle>商品与订单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex min-w-0 gap-4">
              <ManagedImage
                src={resolvedOrder.productImageUrl}
                alt={resolvedOrder.productTitle}
                className="size-28 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">
                  {resolvedOrder.productTitle}
                </h2>
                {resolvedOrder.productDescription ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {resolvedOrder.productDescription}
                  </p>
                ) : null}
                <p className="mt-4 text-sm">
                  {formatPrice(resolvedOrder.unitPriceCents)} ×{" "}
                  {resolvedOrder.quantity}
                </p>
              </div>
              <p className="shrink-0 text-xl font-semibold">
                {formatPrice(resolvedOrder.totalAmountCents)}
              </p>
            </div>
            <Separator />
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              {resolvedOrder.store?.name ? (
                <>
                  <dt className="text-muted-foreground">店铺</dt>
                  <dd className="truncate">{resolvedOrder.store.name}</dd>
                </>
              ) : null}
              {resolvedOrder.store?.address ? (
                <>
                  <dt className="text-muted-foreground">店铺地址</dt>
                  <dd>{resolvedOrder.store.address}</dd>
                </>
              ) : null}
              {resolvedOrder.seller?.name &&
              resolvedOrder.seller.name !== resolvedOrder.store?.name ? (
                <>
                  <dt className="text-muted-foreground">卖家</dt>
                  <dd>{resolvedOrder.seller.name}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>支付信息</CardTitle>
            {bill ? (
              <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                <span className="truncate font-mono tabular-nums">
                  {bill.billNo || bill.id}
                </span>
                <CopyButton
                  value={bill.billNo || String(bill.id)}
                  label="账单号"
                />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {bill ? (
              <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
                <dt className="text-muted-foreground">应付金额</dt>
                <dd className="font-semibold">
                  {formatPrice(bill.amountCents)}
                </dd>
                {bill.payee?.name ? (
                  <>
                    <dt className="text-muted-foreground">收款方</dt>
                    <dd className="truncate">{bill.payee.name}</dd>
                  </>
                ) : null}
                {bill.verifyCode ? (
                  <>
                    <dt className="text-muted-foreground">付款标识码</dt>
                    <dd className="font-mono text-lg font-semibold tracking-widest">
                      {bill.verifyCode}
                    </dd>
                  </>
                ) : null}
                {bill.serialNumber ? (
                  <>
                    <dt className="text-muted-foreground">流水号</dt>
                    <dd className="break-all">{bill.serialNumber}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">账单尚未生成。</p>
            )}
            <div className="flex flex-wrap gap-2">
              {actions.canPay ? (
                <Button
                  onClick={() => setPaymentOpen(true)}
                  disabled={!bill?.updatedAt || !bill.payee?.id}
                >
                  立即支付
                </Button>
              ) : null}
              {actions.canSupplementSerialNumber ? (
                <Button
                  variant="outline"
                  onClick={() => setSupplementOpen(true)}
                >
                  补充流水号
                </Button>
              ) : null}
              {actions.canConfirmPayment ? (
                <Button
                  onClick={() => setConfirmation("confirm")}
                  disabled={!bill?.updatedAt}
                >
                  确认收款
                </Button>
              ) : null}
              {actions.canComplete ? (
                <Button onClick={() => setConfirmation("complete")}>
                  确认完成
                </Button>
              ) : null}
              {actions.canCancel ? (
                <Button
                  variant="outline"
                  onClick={() => setConfirmation("cancel")}
                >
                  取消订单
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        order={resolvedOrder}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        onPaid={(updatedBill) => {
          setCurrentOrder((value) => ({ ...value, bill: updatedBill }));
          router.refresh();
        }}
      />

      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => !open && !pending && setConfirmation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation === "cancel"
                ? "取消订单"
                : confirmation === "complete"
                  ? "完成订单"
                  : "确认收款"}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "cancel"
                ? "取消后订单将停止处理，关联账单也会关闭。"
                : confirmation === "complete"
                  ? "完成后订单将进入最终状态。"
                  : "请核对收款方、金额和付款标识码，确认实际款项已经到账。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmation(null)}
              disabled={pending}
            >
              返回检查
            </Button>
            <Button
              onClick={() => confirmation && mutate(confirmation)}
              disabled={pending}
            >
              {pending ? <Spinner /> : null}
              {confirmation === "cancel"
                ? "取消订单"
                : confirmation === "complete"
                  ? "完成订单"
                  : "确认已到账"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={supplementOpen}
        onOpenChange={(open) => !pending && setSupplementOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>补充支付流水号</DialogTitle>
            <DialogDescription>
              仅在已经支付但缺少流水号时填写。
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="支付流水号"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            placeholder="请输入支付流水号"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSupplementOpen(false)}
              disabled={pending}
            >
              取消
            </Button>
            <Button
              onClick={supplement}
              disabled={pending || !serialNumber.trim()}
            >
              {pending ? <Spinner /> : null}提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  order,
  dataSource,
  connectBaseUrl,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SpotOrder;
  dataSource: DataSource;
  connectBaseUrl: string;
  onPaid: (bill: NonNullable<SpotOrder["bill"]>) => void;
}) {
  const { ensureAgreement } = useTransactionAgreement();
  const [channel, setChannel] = useState<PaymentQrChannel>("wechat");
  const [codes, setCodes] = useState<Partial<Record<PaymentQrChannel, string>>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const loadedForRef = useRef<string | null>(null);
  const payingRef = useRef(false);
  const bill = order.bill;

  useEffect(() => {
    const payeeId = bill?.payee?.id;
    if (!open || !payeeId || loadedForRef.current === payeeId) return;
    let cancelled = false;
    setLoading(true);
    void listPaymentQrCodes({ dataSource, connectBaseUrl, ownerId: payeeId })
      .then((result) => {
        if (cancelled) return;
        const mapped = Object.fromEntries(
          result.map((item) => [item.channel, item.content]),
        ) as Partial<Record<PaymentQrChannel, string>>;
        setCodes(mapped);
        setChannel(mapped.wechat ? "wechat" : "alipay");
        loadedForRef.current = payeeId;
      })
      .catch(() => {
        if (!cancelled) toast.error("收款码加载失败，请稍后重试");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bill?.payee?.id, connectBaseUrl, dataSource, open]);

  async function submitPayment() {
    if (!bill?.updatedAt || !codes[channel] || payingRef.current) return;
    const billToPay = bill;
    const billVersion = bill.updatedAt;
    const paymentChannel = channel;
    if (!(await ensureAgreement(() => onOpenChange(false)))) return;
    if (payingRef.current) return;
    payingRef.current = true;
    setPaying(true);
    try {
      const updated = await payBill(
        {
          billId: billToPay.id,
          channel: paymentChannel,
          updatedAt: billVersion,
        },
        { dataSource, connectBaseUrl },
      );
      onPaid(updated);
      onOpenChange(false);
      toast.success("已提交支付，等待卖家确认");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "支付提交失败，请检查账单状态后重试",
      );
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  const content = codes[channel];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            扫码支付 {formatPrice(bill?.amountCents ?? order.totalAmountCents)}
          </DialogTitle>
          <DialogDescription>
            请核对收款方、金额和付款标识码，扫码完成后点击“我已支付”。
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={channel}
          onValueChange={(value) => setChannel(value as PaymentQrChannel)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="wechat" disabled={!codes.wechat}>
              微信
            </TabsTrigger>
            <TabsTrigger value="alipay" disabled={!codes.alipay}>
              支付宝
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex min-h-64 items-center justify-center rounded-xl bg-white p-5">
          {loading ? (
            <Spinner className="text-primary" />
          ) : content ? (
            <QRCodeCanvas value={content} size={220} level="M" />
          ) : (
            <p className="text-sm text-muted-foreground">暂无可用收款码</p>
          )}
        </div>
        {bill?.verifyCode ? (
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">付款标识码</span>
            <span className="font-mono text-lg font-semibold tracking-widest">
              {bill.verifyCode}
            </span>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={paying}
          >
            稍后支付
          </Button>
          <Button
            onClick={submitPayment}
            disabled={paying || !content || !bill?.updatedAt}
          >
            {paying ? <Spinner /> : null}我已支付
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildSpotOrderTimeline(order: SpotOrder) {
  return [
    { label: "创建订单", timestamp: order.createdAt, kind: "created" },
    { label: "完成支付", timestamp: order.paidAt, kind: "paid" },
    { label: "完成订单", timestamp: order.completedAt, kind: "completed" },
    { label: "取消订单", timestamp: order.cancelledAt, kind: "cancelled" },
  ].filter((node): node is { label: string; timestamp: string; kind: string } =>
    isValidTimestamp(node.timestamp),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isValidTimestamp(value: string | null): value is string {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}
