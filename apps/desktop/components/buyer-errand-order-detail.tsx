"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiAlipayLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiWechatPayLine,
} from "@remixicon/react";
import {
  getBill,
  listPaymentQrCodes,
  payBill,
  supplementBillSerialNumber,
  type BuyerErrandOrderDetail,
  type BuyerErrandOrderProductItem,
  type DataSource,
  type PaymentBill,
  type PaymentQrChannel,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
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
  buildBuyerErrandOrderTimeline,
  getBuyerErrandOrderAmountBreakdown,
  reconcileBuyerErrandOrderUpdate,
  resolveBuyerErrandPaymentState,
} from "@/lib/buyer-errand-order";
import { readDefaultPaymentPlatform } from "@/lib/payment-preferences";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { ManagedImage } from "./managed-image";
import { LarkContactButton } from "./lark-contact-button";
import { useTransactionAgreement } from "./transaction-agreement-provider";

export function BuyerErrandOrderDetailView({
  order,
  dataSource,
  connectBaseUrl,
}: {
  order: BuyerErrandOrderDetail;
  dataSource: DataSource;
  connectBaseUrl?: string;
}) {
  const router = useRouter();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [unverifiedPaymentVersion, setUnverifiedPaymentVersion] = useState<
    string | null
  >(null);
  const [unverifiedSupplementVersion, setUnverifiedSupplementVersion] =
    useState<string | null>(null);
  const resolvedOrder = reconcileBuyerErrandOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const billVersion = bill?.updatedAt ? `${bill.id}:${bill.updatedAt}` : null;
  const paymentUnverified =
    billVersion !== null && billVersion === unverifiedPaymentVersion;
  const supplementUnverified =
    billVersion !== null && billVersion === unverifiedSupplementVersion;
  const paymentState = resolveBuyerErrandPaymentState(
    resolvedOrder.status,
    bill,
  );
  const canSupplement = Boolean(
    paymentState === "submitted" && bill?.updatedAt && !bill.serialNumber,
  );

  function updateBill(updatedBill: PaymentBill) {
    setCurrentOrder({ ...resolvedOrder, bill: updatedBill });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="-ml-3 mb-2">
            <Link href="/orders?type=errand&view=participant">
              <RiArrowLeftLine data-icon="inline-start" />
              返回跑腿订单
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              跑腿订单详情
            </h1>
            <Badge
              variant={getStatusBadgeVariant(resolvedOrder.status)}
              className="shrink-0"
            >
              {getStatusLabel(resolvedOrder.status)}
            </Badge>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            {resolvedOrder.store?.name ? (
              <>
                <span className="truncate">{resolvedOrder.store.name}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span className="shrink-0 font-mono tabular-nums">
              {resolvedOrder.id}
            </span>
            <CopyButton value={String(resolvedOrder.id)} label="订单号" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LarkContactButton
            target="errand-captain"
            orderId={String(resolvedOrder.id)}
            dataSource={dataSource}
            connectBaseUrl={connectBaseUrl}
            label="联系团长"
          />
          {paymentState === "payable" && bill ? (
            <Button
              onClick={() => setPaymentOpen(true)}
              disabled={paymentUnverified}
            >
              去支付
            </Button>
          ) : null}
        </div>
      </section>

      <StatusNotice order={resolvedOrder} paymentState={paymentState} />
      {paymentUnverified || supplementUnverified ? (
        <p className="text-sm text-muted-foreground">
          账单结果待核实，订单更新后可继续操作。
        </p>
      ) : null}
      <ProgressSteps order={resolvedOrder} />

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)]">
        <ProductItemsCard items={resolvedOrder.productItems} />
        <div className="grid min-w-0 gap-5">
          {resolvedOrder.captain ? (
            <Card>
              <CardHeader>
                <CardTitle>采购团长</CardTitle>
              </CardHeader>
              <CardContent className="flex min-w-0 items-center gap-3">
                <Avatar className="size-11">
                  <AvatarImage
                    src={resolvedOrder.captain.avatarUrl}
                    alt={resolvedOrder.captain.name}
                  />
                  <AvatarFallback>
                    {resolvedOrder.captain.name.trim().slice(0, 1) || "团"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {resolvedOrder.captain.name}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <AmountSummaryCard order={resolvedOrder} />
          {bill ? (
            <BillCard
              bill={bill}
              onSupplement={
                canSupplement && !supplementUnverified
                  ? () => setSupplementOpen(true)
                  : undefined
              }
            />
          ) : null}
        </div>
      </div>

      {paymentState === "payable" && bill ? (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          bill={bill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onPaid={(updatedBill) => {
            setUnverifiedPaymentVersion(null);
            updateBill(updatedBill);
          }}
          onBillRefresh={(latestBill) => {
            if (latestBill) {
              setUnverifiedPaymentVersion(null);
              updateBill(latestBill);
            } else if (billVersion) {
              setUnverifiedPaymentVersion(billVersion);
              router.refresh();
            }
          }}
          unverified={paymentUnverified}
        />
      ) : null}
      {canSupplement && bill?.updatedAt ? (
        <SupplementDialog
          open={supplementOpen}
          onOpenChange={setSupplementOpen}
          bill={bill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onUpdated={(updatedBill) => {
            setUnverifiedSupplementVersion(null);
            updateBill(updatedBill);
          }}
          onBillRefresh={(latestBill) => {
            if (latestBill) {
              setUnverifiedSupplementVersion(null);
              updateBill(latestBill);
            } else if (billVersion) {
              setUnverifiedSupplementVersion(billVersion);
              router.refresh();
            }
          }}
          unverified={supplementUnverified}
        />
      ) : null}
    </div>
  );
}

function StatusNotice({
  order,
  paymentState,
}: {
  order: BuyerErrandOrderDetail;
  paymentState: ReturnType<typeof resolveBuyerErrandPaymentState>;
}) {
  if (order.status === "open") {
    return (
      <Alert>
        <RiInformationLine />
        <AlertTitle>等待团长接单</AlertTitle>
        <AlertDescription>
          尚未接单的商品会继续保留在跑腿大厅。
        </AlertDescription>
      </Alert>
    );
  }
  if (paymentState === "self_purchase") {
    return (
      <Alert>
        <RiInformationLine />
        <AlertTitle>无需支付</AlertTitle>
        <AlertDescription>团长自购，当前订单无需支付。</AlertDescription>
      </Alert>
    );
  }
  if (paymentState === "unavailable") {
    return (
      <Alert variant="destructive">
        <RiErrorWarningLine />
        <AlertTitle>支付信息暂不可用</AlertTitle>
        <AlertDescription>
          账单缺少收款人或版本信息，为避免付错款，当前不能支付。
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

function ProgressSteps({ order }: { order: BuyerErrandOrderDetail }) {
  const steps = buildBuyerErrandOrderTimeline(order);

  return (
    <Card>
      <CardContent
        className="grid gap-0 p-5"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => {
          return (
            <div
              key={step.label}
              className="relative flex min-w-0 flex-col items-center gap-2 px-2 text-center"
            >
              <span
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground",
                  step.cancelled &&
                    "border-destructive bg-destructive text-destructive-foreground",
                )}
              >
                {step.cancelled ? (
                  <RiCloseCircleLine className="size-4" />
                ) : (
                  <RiCheckboxCircleLine className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.label}</p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatTimelineDateTime(step.timestamp)}
                </p>
              </div>
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "absolute left-1/2 right-[-50%] top-4 h-px bg-border",
                    step.cancelled ? "bg-destructive" : "bg-primary",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProductItemsCard({ items }: { items: BuyerErrandOrderProductItem[] }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>商品明细</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {items.map((item, index) => (
          <div key={item.demandItemId} className="grid gap-4">
            {index > 0 ? <Separator /> : null}
            <div className="flex min-w-0 gap-4">
              <ManagedImage
                src={item.productTemplate.mainImageUrl}
                alt={item.productTemplate.title}
                fit="contain"
                preview
                className="size-24 shrink-0 rounded-lg border"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {item.productTemplate.title}
                </p>
                {item.productTemplate.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {item.productTemplate.description}
                  </p>
                ) : null}
                {item.nonPurchaseReason ? (
                  <p className="mt-2 text-sm text-destructive">
                    未购买：{item.nonPurchaseReason}
                  </p>
                ) : null}
              </div>
              <dl className="grid shrink-0 grid-cols-3 gap-5 text-center text-sm">
                <QuantityMetric label="需求" value={item.requiredQuantity} />
                <QuantityMetric label="采购" value={item.purchasedQuantity} />
                <QuantityMetric label="分发" value={item.distributedQuantity} />
              </dl>
              <div className="w-28 shrink-0 text-right">
                <p className="font-semibold">
                  {item.purchasedQuantity === null
                    ? "待结算"
                    : formatPrice(item.subtotalCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  跑腿费 {formatPrice(item.serviceFeePerUnitCents)} / 件
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QuantityMetric({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">
        {value === null ? "待处理" : `${value} 件`}
      </dd>
    </div>
  );
}

function AmountSummaryCard({ order }: { order: BuyerErrandOrderDetail }) {
  const amount = getBuyerErrandOrderAmountBreakdown(order);
  return (
    <Card>
      <CardHeader>
        <CardTitle>金额汇总</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">
            {order.totalActualAmountCents === null
              ? "预估商品金额"
              : "商品金额"}
          </dt>
          <dd>{formatPrice(amount.productAmountCents)}</dd>
          <dt className="text-muted-foreground">跑腿费</dt>
          <dd>{formatPrice(amount.serviceFeeCents)}</dd>
          {amount.packagingShareCents > 0 ? (
            <>
              <dt className="text-muted-foreground">分摊包装费</dt>
              <dd>{formatPrice(amount.packagingShareCents)}</dd>
            </>
          ) : null}
          <dt className="border-t pt-3 font-medium">合计</dt>
          <dd className="border-t pt-3 text-lg font-semibold text-primary">
            {formatPrice(amount.totalAmountCents)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function BillCard({
  bill,
  onSupplement,
}: {
  bill: PaymentBill;
  onSupplement?: () => void;
}) {
  const payeeName = bill.payee?.name?.trim() || "未提供姓名";
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>支付账单</CardTitle>
          <div className="flex min-w-0 items-center gap-1">
            <CardDescription className="truncate font-mono tabular-nums">
              {bill.billNo || bill.id}
            </CardDescription>
            <CopyButton value={bill.billNo || String(bill.id)} label="账单号" />
          </div>
        </div>
        <Badge
          variant={
            bill.status === "completed"
              ? "success"
              : bill.status === "submitted"
                ? "attention"
                : bill.status === "unpaid"
                  ? "payment"
                  : "neutral"
          }
        >
          {getBillStatusLabel(bill.status)}
        </Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
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
              <dt className="flex items-center gap-1 text-muted-foreground">
                付款标识码
                <PaymentCodeHelp />
              </dt>
              <dd className="break-all text-right font-mono font-semibold">
                {bill.verifyCode}
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
              <dt className="text-muted-foreground">流水号</dt>
              <dd className="break-all text-right font-mono">
                {bill.serialNumber}
              </dd>
            </>
          ) : null}
        </dl>
        {bill.status === "submitted" ? (
          <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
            付款信息已提交，等待团长核对到账
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

function PaymentDialog({
  open,
  onOpenChange,
  bill,
  dataSource,
  connectBaseUrl,
  onPaid,
  onBillRefresh,
  unverified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: PaymentBill;
  dataSource: DataSource;
  connectBaseUrl?: string;
  onPaid: (bill: PaymentBill) => void;
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
  const payeeName = bill.payee?.name?.trim() || "未提供姓名";
  const qrKey =
    bill.payee?.id && bill.updatedAt
      ? `${bill.payee.id}:${bill.updatedAt}:${reloadCount}`
      : null;
  const currentCodes =
    qrResult?.key === qrKey && !qrResult.error ? qrResult.codes : {};
  const qrError = qrResult?.key === qrKey && qrResult.error;
  const loading = open && Boolean(qrKey) && qrResult?.key !== qrKey;

  useEffect(() => {
    const payeeId = bill.payee?.id;
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
  }, [bill.payee?.id, connectBaseUrl, dataSource, open, qrKey, qrResult?.key]);

  async function submit() {
    if (
      !bill.updatedAt ||
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
      toast.success("已提交支付，等待团长确认");
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
          <DialogTitle>扫码支付 {formatPrice(bill.amountCents)}</DialogTitle>
          <DialogDescription>
            请核对收款人、金额和付款标识码，扫码完成后再提交支付状态。
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg bg-muted/70 p-3 text-sm">
              <dt className="text-muted-foreground">应付金额</dt>
              <dd className="font-semibold text-primary">
                {formatPrice(bill.amountCents)}
              </dd>
              <dt className="text-muted-foreground">收款人</dt>
              <dd className="flex min-w-0 items-center gap-2 font-medium">
                <Avatar className="size-6" aria-hidden="true">
                  <AvatarImage
                    src={bill.payee?.avatarUrl || undefined}
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
                {bill.verifyCode || "暂无"}
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
            onClick={submit}
            disabled={paying || !content || !bill.updatedAt || unverified}
          >
            {paying ? <Spinner /> : null}我已支付
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplementDialog({
  open,
  onOpenChange,
  bill,
  dataSource,
  connectBaseUrl,
  onUpdated,
  onBillRefresh,
  unverified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: PaymentBill;
  dataSource: DataSource;
  connectBaseUrl?: string;
  onUpdated: (bill: PaymentBill) => void;
  onBillRefresh: (bill: PaymentBill | null) => void;
  unverified: boolean;
}) {
  const { ensureAgreement } = useTransactionAgreement();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  async function submit() {
    if (!bill.updatedAt || !value.trim() || pendingRef.current || unverified)
      return;
    const billToSupplement = bill;
    const billVersion = bill.updatedAt;
    const submittedSerialNumber = value.trim();
    if (!(await ensureAgreement(() => onOpenChange(false)))) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const updated = await supplementBillSerialNumber(
        {
          billId: billToSupplement.id,
          serialNumber: submittedSerialNumber,
          updatedAt: billVersion,
        },
        { dataSource, connectBaseUrl },
      );
      onUpdated(updated);
      onOpenChange(false);
      toast.success("支付流水号已补充");
    } catch (error) {
      try {
        const latestBill = await getBill(billToSupplement.id, {
          dataSource,
          connectBaseUrl,
        });
        onOpenChange(false);
        if (latestBill.serialNumber === submittedSerialNumber) {
          onUpdated(latestBill);
          toast.info("已读取最新支付流水号");
        } else {
          onBillRefresh(latestBill);
          toast.error(
            error instanceof Error
              ? `${error.message}，账单已刷新`
              : "账单已刷新，请核对后重试",
          );
        }
      } catch {
        onOpenChange(false);
        onBillRefresh(null);
        toast.error("无法确认流水号提交结果，正在刷新订单，请核对后再操作");
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pendingRef.current && onOpenChange(next)}
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
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="请输入交易单号或流水号"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => !pendingRef.current && onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !value.trim()}>
            {pending ? <Spinner /> : null}提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getBillStatusLabel(status: PaymentBill["status"]): string {
  if (status === "unpaid") return "待支付";
  if (status === "submitted") return "待确认收款";
  if (status === "completed") return "已完成";
  if (status === "closed") return "已关闭";
  return "状态异常";
}

function formatTimelineDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
