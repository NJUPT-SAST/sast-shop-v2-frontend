"use client";

import { useTransactionAgreement } from "./transaction-agreement-provider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiErrorWarningLine,
  RiFileList3Line,
  RiInformationLine,
  RiTimeLine,
} from "@remixicon/react";
import type {
  BuyerErrandOrderDetail,
  BuyerErrandOrderProductItem,
  DataSource,
  PaymentBill,
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
import { Separator } from "@workspace/ui/components/separator";

import {
  buildBuyerErrandOrderTimeline,
  getBuyerErrandOrderAmountBreakdown,
  reconcileBuyerErrandOrderUpdate,
  resolveBuyerErrandPaymentState,
} from "@/lib/buyer-errand-order-detail";
import { resolveOrderContactAction } from "@/lib/order-contact";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { ManagedImage } from "./managed-image";
import {
  LarkContactButton,
  useLarkContactAvailability,
} from "./lark-contact-button";
import { MobileFixedFooter } from "./mobile-fixed-footer";
import {
  isPayablePaymentBill,
  PaymentSection,
  SupplementSerialNumberDialog,
} from "./payment-flow";

export function BuyerErrandOrderDetailView({
  order,
  dataSource,
  connectBaseUrl,
}: {
  order: BuyerErrandOrderDetail;
  dataSource: DataSource;
  connectBaseUrl: string;
}) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [unverifiedPaymentBillVersion, setUnverifiedPaymentBillVersion] =
    useState<string | null>(null);
  const [unverifiedSupplementBillVersion, setUnverifiedSupplementBillVersion] =
    useState<string | null>(null);
  const resolvedOrder = reconcileBuyerErrandOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const paymentState = resolveBuyerErrandPaymentState(
    resolvedOrder.status,
    bill,
  );
  const payableBill = isPayablePaymentBill(bill) ? bill : null;
  const paymentBillVersion = bill?.updatedAt
    ? `${bill.id}:${bill.updatedAt}`
    : null;
  const paymentVersionUnverified =
    paymentBillVersion !== null &&
    paymentBillVersion === unverifiedPaymentBillVersion;
  const supplementBillVersion = bill?.updatedAt
    ? `${bill.id}:${bill.updatedAt}`
    : null;
  const supplementVersionUnverified =
    supplementBillVersion !== null &&
    supplementBillVersion === unverifiedSupplementBillVersion;
  const canSupplementSerialNumber = Boolean(
    paymentState === "submitted" &&
    bill?.updatedAt &&
    !bill.serialNumber &&
    !supplementVersionUnverified,
  );
  const feishuUiEnvironment = useLarkContactAvailability();
  const contactAction = resolveOrderContactAction({
    orderType: "errand",
    view: "participant",
    isFeishuEnvironment: feishuUiEnvironment,
  });
  const canContactCaptain = Boolean(contactAction);
  const showActionBar =
    canContactCaptain ||
    (paymentState === "payable" && payableBill && !paymentVersionUnverified) ||
    canSupplementSerialNumber;

  function updateBill(updatedBill: PaymentBill) {
    setCurrentOrder({ ...resolvedOrder, bill: updatedBill });
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">跑腿订单详情</h1>
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
              <CopyButton
                value={String(resolvedOrder.id)}
                label="订单号"
                compact
              />
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(resolvedOrder.status)}>
            {getStatusLabel(resolvedOrder.status)}
          </Badge>
        </div>

        <OrderTimelinePanel
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          order={resolvedOrder}
        />

        <StatusNotice
          status={resolvedOrder.status}
          paymentState={paymentState}
        />
        <CaptainCard order={resolvedOrder} />
        <ProductItemsCard items={resolvedOrder.productItems} />
        <AmountSummaryCard order={resolvedOrder} />
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
          {paymentState === "payable" &&
          payableBill &&
          !paymentVersionUnverified ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() =>
                void ensureAgreement().then((agreed) => {
                  if (agreed) setPaymentOpen(true);
                })
              }
            >
              去支付 {formatPrice(payableBill.amountCents)}
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
        </MobileFixedFooter>
      ) : null}

      {paymentState === "payable" &&
      payableBill &&
      !paymentVersionUnverified ? (
        <PaymentSection
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          bill={payableBill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={(updatedBill) => {
            setUnverifiedPaymentBillVersion(null);
            updateBill(updatedBill);
            setPaymentOpen(false);
          }}
          onBillRefresh={(latestBill) => {
            if (latestBill) {
              setUnverifiedPaymentBillVersion(null);
              updateBill(latestBill);
            } else {
              setUnverifiedPaymentBillVersion(paymentBillVersion);
              router.refresh();
            }
          }}
        />
      ) : null}

      {canSupplementSerialNumber && bill?.updatedAt ? (
        <SupplementSerialNumberDialog
          open={supplementOpen}
          onOpenChange={setSupplementOpen}
          billId={bill.id}
          billUpdatedAt={bill.updatedAt}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={(updatedBill) => {
            setUnverifiedSupplementBillVersion(null);
            updateBill(updatedBill);
          }}
          onBillRefresh={(latestBill) => {
            if (latestBill) {
              setUnverifiedSupplementBillVersion(null);
              updateBill(latestBill);
            } else {
              setUnverifiedSupplementBillVersion(supplementBillVersion);
              router.refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function StatusNotice({
  status,
  paymentState,
}: {
  status: BuyerErrandOrderDetail["status"];
  paymentState: ReturnType<typeof resolveBuyerErrandPaymentState>;
}) {
  if (status === "open") {
    return (
      <Alert>
        <RiTimeLine />
        <AlertTitle>等待团长接单</AlertTitle>
        <AlertDescription>
          尚未接单的商品会继续保留在跑腿大厅；接单后可在此查看采购进度。
        </AlertDescription>
      </Alert>
    );
  }

  if (paymentState === "submitted") {
    return (
      <Alert>
        <RiTimeLine />
        <AlertTitle>付款信息已提交</AlertTitle>
        <AlertDescription>
          请等待团长核对到账；如需协助，可补充支付流水号。
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
          账单缺少收款人或版本信息，为避免付错款，当前不能发起支付。
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function CaptainCard({ order }: { order: BuyerErrandOrderDetail }) {
  if (!order.captain) return null;

  return (
    <Card>
      <CardHeader className="p-3">
        <CardTitle>采购团长</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 items-center gap-3 p-3 pt-0">
        <Avatar className="size-11">
          <AvatarImage src={order.captain.avatarUrl} alt={order.captain.name} />
          <AvatarFallback>
            {getAvatarFallback(order.captain.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{order.captain.name}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductItemsCard({ items }: { items: BuyerErrandOrderProductItem[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3">
        <CardTitle>商品明细</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-3 pt-0">
        {items.map((item, index) => (
          <div key={item.demandItemId} className="flex flex-col gap-2">
            {index > 0 ? <Separator /> : null}
            <ProductItem item={item} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductItem({ item }: { item: BuyerErrandOrderProductItem }) {
  const title = item.productTemplate.title;
  const hasPurchaseResult = item.purchasedQuantity !== null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 gap-3">
        <ManagedImage
          src={item.productTemplate.mainImageUrl}
          alt={title}
          className="size-18 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{title}</p>
          {item.productTemplate.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.productTemplate.description}
            </p>
          ) : null}
          {item.nonPurchaseReason ? (
            <p className="mt-2 break-words text-sm text-destructive">
              未购买：{item.nonPurchaseReason}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-y py-2 text-center text-xs">
        <div>
          <dt className="text-muted-foreground">需求</dt>
          <dd className="mt-1 font-medium">{item.requiredQuantity} 件</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">采购</dt>
          <dd className="mt-1 font-medium">
            {formatQuantity(item.purchasedQuantity)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">分发</dt>
          <dd className="mt-1 font-medium">
            {formatQuantity(item.distributedQuantity)}
          </dd>
        </div>
      </dl>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">实际单价</dt>
        <dd>
          {item.actualUnitPriceCents != null
            ? formatPrice(item.actualUnitPriceCents)
            : hasPurchaseResult
              ? "未定价"
              : "待采购"}
        </dd>
        <dt className="text-muted-foreground">单件跑腿费</dt>
        <dd>{formatPrice(item.serviceFeePerUnitCents)}</dd>
        <dt className="font-medium">小计</dt>
        <dd className="font-semibold">
          {hasPurchaseResult ? formatPrice(item.subtotalCents) : "待结算"}
        </dd>
      </dl>
    </div>
  );
}

function AmountSummaryCard({ order }: { order: BuyerErrandOrderDetail }) {
  const amount = getBuyerErrandOrderAmountBreakdown(order);

  return (
    <Card>
      <CardHeader className="p-3">
        <CardTitle>金额汇总</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
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
          <dt className="pt-2 font-medium">合计</dt>
          <dd className="pt-2 text-base font-semibold text-primary">
            {formatPrice(amount.totalAmountCents)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function BillCard({ bill }: { bill: PaymentBill }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 p-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>支付账单</CardTitle>
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

function OrderTimelinePanel({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: BuyerErrandOrderDetail;
}) {
  const timeline = buildBuyerErrandOrderTimeline(order);

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <Button
        type="button"
        variant="ghost"
        className="h-12 w-full justify-between rounded-none px-3 hover:bg-muted/50 aria-expanded:bg-transparent aria-expanded:text-foreground"
        aria-expanded={open}
        aria-controls="buyer-errand-order-timeline"
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <RiTimeLine data-icon="inline-start" />
          <span className="truncate">订单节点</span>
        </span>
        {open ? (
          <RiArrowUpSLine className="size-5 text-muted-foreground" />
        ) : (
          <RiArrowDownSLine className="size-5 text-muted-foreground" />
        )}
      </Button>
      <div
        id="buyer-errand-order-timeline"
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
                      {order.status === "cancelled" &&
                      index === timeline.length - 1 ? (
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

function formatQuantity(value: number | null): string {
  return value === null ? "待处理" : `${value} 件`;
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

function getAvatarFallback(name: string): string {
  return name.trim().slice(0, 1) || "团";
}
