"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiAlipayLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiWechatPayLine,
} from "@remixicon/react";
import {
  cancelSpotOrder,
  completeSpotOrder,
  confirmBill,
  getBill,
  getSpotOrderDetail,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type DataSource,
  type PaymentBill,
  type PaymentQrChannel,
  type SpotOrder,
} from "@sast-shop/api";
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
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { CopyButton } from "@workspace/ui/components/copy-button";
import { PaymentCodeHelp } from "@workspace/ui/components/payment-code-help";
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
import { cn } from "@workspace/ui/lib/utils";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

import {
  getSpotOrderStatusLabel,
  reconcileSpotOrderUpdate,
  resolveSpotOrderActions,
  type SpotOrderView,
} from "@/lib/spot-orders";
import { readDefaultPaymentPlatform } from "@/lib/payment-preferences";
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
  const [unverifiedPaymentVersion, setUnverifiedPaymentVersion] = useState<
    string | null
  >(null);
  const [unverifiedSupplementVersion, setUnverifiedSupplementVersion] =
    useState<string | null>(null);
  const [unverifiedLifecycleVersion, setUnverifiedLifecycleVersion] = useState<
    string | null
  >(null);
  const pendingRef = useRef(false);
  const resolvedOrder = reconcileSpotOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const billVersion = bill?.updatedAt ? `${bill.id}:${bill.updatedAt}` : null;
  const lifecycleVersion = `${resolvedOrder.id}:${resolvedOrder.status}:${bill?.status ?? "none"}:${bill?.updatedAt ?? "none"}:${resolvedOrder.completedAt ?? "none"}:${resolvedOrder.cancelledAt ?? "none"}`;
  const lifecycleUnverified = lifecycleVersion === unverifiedLifecycleVersion;
  const paymentUnverified =
    billVersion !== null && billVersion === unverifiedPaymentVersion;
  const supplementUnverified =
    billVersion !== null && billVersion === unverifiedSupplementVersion;
  const actions = resolveSpotOrderActions(
    view,
    resolvedOrder.status,
    bill?.status,
  );
  const canSupplementSerialNumber =
    actions.canSupplementSerialNumber && !bill?.serialNumber;
  const timeline = buildSpotOrderTimeline(resolvedOrder);

  async function mutate(action: Exclude<ConfirmationAction, null>) {
    if (pendingRef.current || lifecycleUnverified) return;
    const orderId = resolvedOrder.id;
    const billToConfirm = bill;
    if (!(await ensureAgreement(() => setConfirmation(null)))) return;
    if (pendingRef.current || lifecycleUnverified) return;
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
      setUnverifiedLifecycleVersion(null);
      router.refresh();
    } catch (error) {
      setConfirmation(null);
      try {
        const latestOrder = await getSpotOrderDetail(orderId, {
          dataSource,
          connectBaseUrl,
        });
        setCurrentOrder(latestOrder);
        setUnverifiedLifecycleVersion(null);
        const completed =
          action === "cancel"
            ? latestOrder.status === "cancelled"
            : action === "complete"
              ? latestOrder.status === "completed"
              : latestOrder.bill?.status === "completed";
        if (completed) {
          toast.info("已读取最新订单状态");
        } else {
          toast.error(
            error instanceof Error
              ? `${error.message}，订单已刷新，请核对后重试`
              : "订单状态已刷新，请核对后重试",
          );
        }
      } catch {
        setUnverifiedLifecycleVersion(lifecycleVersion);
        toast.error("无法确认操作结果，正在刷新订单，请核对后再操作");
      }
      router.refresh();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function supplement() {
    if (
      !bill?.updatedAt ||
      !serialNumber.trim() ||
      pendingRef.current ||
      supplementUnverified
    )
      return;
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
      setUnverifiedSupplementVersion(null);
      setSupplementOpen(false);
      toast.success("支付流水号已补充");
      router.refresh();
    } catch (error) {
      try {
        const latestBill = await getBill(billToSupplement.id, {
          dataSource,
          connectBaseUrl,
        });
        setCurrentOrder((value) => ({ ...value, bill: latestBill }));
        setSupplementOpen(false);
        if (latestBill.serialNumber === submittedSerialNumber) {
          setUnverifiedSupplementVersion(null);
          toast.info("已读取最新支付流水号");
        } else {
          toast.error(
            error instanceof Error
              ? `${error.message}，账单已刷新`
              : "账单已刷新，请核对后重试",
          );
        }
      } catch {
        setUnverifiedSupplementVersion(`${billToSupplement.id}:${billVersion}`);
        setSupplementOpen(false);
        toast.error("无法确认流水号提交结果，正在刷新订单，请核对后再操作");
      }
      router.refresh();
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view === "buyer" ? (
            <LarkContactButton
              target="spot-seller"
              orderId={String(resolvedOrder.id)}
              dataSource={dataSource}
              connectBaseUrl={connectBaseUrl}
              label="联系卖家"
            />
          ) : null}
          {actions.canCancel ? (
            <Button
              variant="destructive-text"
              size="touch"
              onClick={() => setConfirmation("cancel")}
              disabled={lifecycleUnverified}
            >
              取消订单
            </Button>
          ) : null}
        </div>
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
                fit="contain"
                preview
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
          <CardContent className="space-y-3">
            {bill ? (
              <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">应付金额</dt>
                <dd className="font-semibold">
                  {formatPrice(bill.amountCents)}
                </dd>
                {bill.payee?.name ? (
                  <>
                    <dt className="text-muted-foreground">收款方</dt>
                    <dd className="flex min-w-0 items-center gap-2 font-medium">
                      <Avatar className="size-6" aria-hidden="true">
                        <AvatarImage
                          src={bill.payee.avatarUrl || undefined}
                          alt=""
                        />
                        <AvatarFallback className="text-xs">
                          {Array.from(bill.payee.name.trim())[0] || "未"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 break-all">
                        {bill.payee.name}
                      </span>
                    </dd>
                  </>
                ) : null}
                {bill.verifyCode ? (
                  <>
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      付款标识码
                      <PaymentCodeHelp />
                    </dt>
                    <dd className="font-mono text-lg font-semibold tracking-widest">
                      {bill.verifyCode}
                    </dd>
                  </>
                ) : null}
                {bill.channel ? (
                  <>
                    <dt className="text-muted-foreground">支付方式</dt>
                    <dd className="flex items-center gap-1.5">
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
                  disabled={
                    !bill?.updatedAt || !bill.payee?.id || paymentUnverified
                  }
                >
                  立即支付
                </Button>
              ) : null}
              {canSupplementSerialNumber ? (
                <Button
                  variant="plain"
                  size="touch"
                  className="h-auto min-h-0 px-0 py-0 text-sm leading-5"
                  onClick={() => setSupplementOpen(true)}
                  disabled={supplementUnverified}
                >
                  忘记备注？补充流水号
                </Button>
              ) : null}
              {actions.canConfirmPayment ? (
                <Button
                  onClick={() => setConfirmation("confirm")}
                  disabled={!bill?.updatedAt || lifecycleUnverified}
                >
                  确认收款
                </Button>
              ) : null}
              {actions.canComplete ? (
                <Button
                  onClick={() => setConfirmation("complete")}
                  disabled={lifecycleUnverified}
                >
                  确认完成
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {paymentUnverified || supplementUnverified || lifecycleUnverified ? (
        <p className="text-sm text-muted-foreground">
          操作结果待核实，订单更新后可继续操作。
        </p>
      ) : null}

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        order={resolvedOrder}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        onPaid={(updatedBill) => {
          setUnverifiedPaymentVersion(null);
          setCurrentOrder((value) => ({ ...value, bill: updatedBill }));
          router.refresh();
        }}
        onBillRefresh={(latestBill) => {
          if (latestBill) {
            setUnverifiedPaymentVersion(null);
            setCurrentOrder((value) => ({ ...value, bill: latestBill }));
          } else if (billVersion) {
            setUnverifiedPaymentVersion(billVersion);
          }
          router.refresh();
        }}
        unverified={paymentUnverified}
      />

      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) =>
          !open && !pendingRef.current && setConfirmation(null)
        }
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
              onClick={() => !pendingRef.current && setConfirmation(null)}
              disabled={pending || lifecycleUnverified}
            >
              返回检查
            </Button>
            <Button
              onClick={() => confirmation && mutate(confirmation)}
              disabled={pending || lifecycleUnverified}
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
        onOpenChange={(open) => !pendingRef.current && setSupplementOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>补充支付流水号</DialogTitle>
            <DialogDescription>
              忘记备注付款标识码时，可补充交易单号协助核款
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="支付流水号"
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            placeholder="请输入交易单号或流水号"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => !pendingRef.current && setSupplementOpen(false)}
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
  onBillRefresh,
  unverified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SpotOrder;
  dataSource: DataSource;
  connectBaseUrl: string;
  onPaid: (bill: NonNullable<SpotOrder["bill"]>) => void;
  onBillRefresh: (bill: PaymentBill | null) => void;
  unverified: boolean;
}) {
  const { ensureAgreement } = useTransactionAgreement();
  const [channel, setChannel] = useState<PaymentQrChannel>("wechat");
  const [qrResult, setQrResult] = useState<{
    key: string;
    codes: Partial<Record<PaymentQrChannel, string>>;
    error: boolean;
  } | null>(null);
  const [paying, setPaying] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const payingRef = useRef(false);
  const bill = order.bill;
  const payeeName = bill?.payee?.name?.trim() || "未提供姓名";
  const qrKey =
    bill?.payee?.id && bill.updatedAt
      ? `${bill.payee.id}:${bill.updatedAt}:${reloadCount}`
      : null;
  const currentCodes =
    qrResult?.key === qrKey && !qrResult.error ? qrResult.codes : {};
  const qrError = qrResult?.key === qrKey && qrResult.error;
  const loading = open && Boolean(qrKey) && qrResult?.key !== qrKey;

  useEffect(() => {
    const payeeId = bill?.payee?.id;
    if (!open || !payeeId || !qrKey || qrResult?.key === qrKey) return;
    let cancelled = false;
    void listPaymentQrCodes({ dataSource, connectBaseUrl, ownerId: payeeId })
      .then((result) => {
        if (cancelled) return;
        const mapped = Object.fromEntries(
          result.map((item) => [item.channel, item.content]),
        ) as Partial<Record<PaymentQrChannel, string>>;
        setQrResult({ key: qrKey, codes: mapped, error: false });
        const preferred = readDefaultPaymentPlatform();
        setChannel(
          mapped[preferred] ? preferred : mapped.wechat ? "wechat" : "alipay",
        );
      })
      .catch(() => {
        if (!cancelled) setQrResult({ key: qrKey, codes: {}, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [bill?.payee?.id, connectBaseUrl, dataSource, open, qrKey, qrResult?.key]);

  async function submitPayment() {
    if (
      !bill?.updatedAt ||
      !currentCodes[channel] ||
      payingRef.current ||
      unverified
    )
      return;
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
      try {
        const latestBill = await getBill(billToPay.id, {
          dataSource,
          connectBaseUrl,
        });
        onOpenChange(false);
        if (
          latestBill.status === "submitted" ||
          latestBill.status === "completed"
        ) {
          onPaid(latestBill);
          toast.info("已读取最新支付状态");
        } else {
          onBillRefresh(latestBill);
          toast.error(
            latestBill.status === "unpaid"
              ? "支付确认未完成，账单已刷新，请核对后重试"
              : error instanceof Error
                ? error.message
                : "账单状态已更新，请核对后重试",
          );
        }
      } catch {
        onOpenChange(false);
        onBillRefresh(null);
        toast.error("无法确认支付结果，正在刷新订单，请核对后再操作");
      }
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  const content = currentCodes[channel];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (payingRef.current) return;
        if (!next) setQrResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[min(90dvh,48rem)] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            扫码支付 {formatPrice(bill?.amountCents ?? order.totalAmountCents)}
          </DialogTitle>
          <DialogDescription>
            请核对收款方、金额和付款标识码，扫码完成后点击“我已支付”。
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg bg-muted/70 p-3 text-sm">
              <dt className="text-muted-foreground">应付金额</dt>
              <dd className="font-semibold text-primary">
                {formatPrice(bill?.amountCents ?? order.totalAmountCents)}
              </dd>
              <dt className="text-muted-foreground">收款人</dt>
              <dd className="flex min-w-0 items-center gap-2 font-medium">
                <Avatar className="size-6" aria-hidden="true">
                  <AvatarImage
                    src={bill?.payee?.avatarUrl || undefined}
                    alt=""
                  />
                  <AvatarFallback className="bg-background text-xs">
                    {Array.from(payeeName)[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 break-all">{payeeName}</span>
              </dd>
              <dt className="flex items-center gap-1 text-muted-foreground">
                付款标识码
                <PaymentCodeHelp />
              </dt>
              <dd className="break-all font-mono font-semibold">
                {bill?.verifyCode || "暂无"}
              </dd>
            </dl>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <Tabs
              value={channel}
              onValueChange={(value) => setChannel(value as PaymentQrChannel)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="wechat" disabled={!currentCodes.wechat}>
                  <RiWechatPayLine
                    aria-hidden="true"
                    className="size-4 text-[#07c160]"
                  />
                  微信
                </TabsTrigger>
                <TabsTrigger value="alipay" disabled={!currentCodes.alipay}>
                  <RiAlipayLine
                    aria-hidden="true"
                    className="size-4 text-[#1677ff]"
                  />
                  支付宝
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div
              className={cn(
                "flex min-h-52 items-center justify-center rounded-xl p-3",
                content ? "bg-white" : "bg-muted",
              )}
            >
              {loading ? (
                <Spinner className="text-primary" />
              ) : content ? (
                <QRCodeCanvas value={content} size={192} level="M" />
              ) : qrError ? (
                <Button
                  variant="outline"
                  onClick={() => setReloadCount((value) => value + 1)}
                >
                  收款码加载失败，重试
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">暂无可用收款码</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            onClick={() => !payingRef.current && onOpenChange(false)}
            disabled={paying}
          >
            稍后支付
          </Button>
          <Button
            onClick={submitPayment}
            disabled={paying || !content || !bill?.updatedAt || unverified}
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
