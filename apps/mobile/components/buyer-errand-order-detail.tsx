"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { Separator } from "@workspace/ui/components/separator";

import {
  buildBuyerErrandOrderTimeline,
  getBuyerErrandOrderAdjustmentCents,
  getBuyerErrandOrderAmountCents,
  reconcileBuyerErrandOrderUpdate,
  resolveBuyerErrandPaymentState,
} from "@/lib/buyer-errand-order-detail";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { ManagedImage } from "./managed-image";
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
  const [currentOrder, setCurrentOrder] = useState(order);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const resolvedOrder = reconcileBuyerErrandOrderUpdate(currentOrder, order);
  const bill = resolvedOrder.bill;
  const paymentState = resolveBuyerErrandPaymentState(
    resolvedOrder.status,
    bill,
  );
  const payableBill = isPayablePaymentBill(bill) ? bill : null;
  const canSupplementSerialNumber = Boolean(
    paymentState === "submitted" && bill?.updatedAt && !bill.serialNumber,
  );
  const showActionBar =
    (paymentState === "payable" && payableBill) || canSupplementSerialNumber;

  function updateBill(updatedBill: PaymentBill) {
    setCurrentOrder({ ...resolvedOrder, bill: updatedBill });
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        className={`flex min-w-0 flex-1 flex-col gap-4 py-4 ${showActionBar ? "pb-24" : ""}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">跑腿订单详情</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {resolvedOrder.store?.name ?? "跑腿店铺"}
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(resolvedOrder.status)}>
            {getStatusLabel(resolvedOrder.status)}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-auto w-full justify-between py-3"
          onClick={() => setTimelineOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <RiTimeLine data-icon="inline-start" />
            <span className="truncate">关键时间</span>
          </span>
          <span className="shrink-0 text-muted-foreground">查看时间</span>
        </Button>

        <StatusNotice order={resolvedOrder} paymentState={paymentState} />
        <OrderInfoCard order={resolvedOrder} />
        <CaptainCard order={resolvedOrder} />
        <ProductItemsCard items={resolvedOrder.productItems} />
        <AmountSummaryCard order={resolvedOrder} />
        {bill ? <BillCard bill={bill} /> : null}
      </div>

      {showActionBar ? (
        <MobileFixedFooter>
          {paymentState === "payable" && payableBill ? (
            <Button
              type="button"
              className="flex-1"
              onClick={() => setPaymentOpen(true)}
            >
              去支付 {formatPrice(payableBill.amountCents)}
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
        </MobileFixedFooter>
      ) : null}

      <TimelineDrawer
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        order={resolvedOrder}
      />

      {paymentState === "payable" && payableBill ? (
        <PaymentSection
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          bill={payableBill}
          dataSource={dataSource}
          connectBaseUrl={connectBaseUrl}
          onSuccess={(updatedBill) => {
            updateBill(updatedBill);
            setPaymentOpen(false);
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
          onSuccess={updateBill}
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
          尚未接单的商品会继续保留在这笔需求中。
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

function OrderInfoCard({ order }: { order: BuyerErrandOrderDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>订单信息</CardTitle>
        <CardDescription>订单号 #{order.id}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">店铺</dt>
          <dd className="min-w-0 break-words text-right">
            {order.store?.name ?? "暂无店铺信息"}
          </dd>
          <dt className="text-muted-foreground">创建时间</dt>
          <dd className="text-right">{formatDateTime(order.createdAt)}</dd>
          <dt className="text-muted-foreground">期望送达</dt>
          <dd className="text-right">{formatDateTime(order.deadline)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function CaptainCard({ order }: { order: BuyerErrandOrderDetail }) {
  if (!order.captain) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>采购团长</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 items-center gap-3">
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
      <CardHeader>
        <CardTitle>商品明细</CardTitle>
        <CardDescription>共 {items.length} 种商品</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无商品明细</p>
        ) : (
          items.map((item, index) => (
            <div key={item.demandItemId} className="flex flex-col gap-3">
              {index > 0 ? <Separator /> : null}
              <ProductItem item={item} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProductItem({ item }: { item: BuyerErrandOrderProductItem }) {
  const title = item.productTemplate?.title ?? "商品信息暂不可用";
  const hasPurchaseResult = item.purchasedQuantity !== null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 gap-3">
        <ManagedImage
          src={item.productTemplate?.mainImageUrl}
          alt={title}
          className="size-18 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {item.productTemplate?.description || "暂无商品规格"}
          </p>
          {item.nonPurchaseReason ? (
            <p className="mt-2 break-words text-sm text-destructive">
              未购买：{item.nonPurchaseReason}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center text-xs">
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
          {hasPurchaseResult
            ? formatPrice(item.actualUnitPriceCents)
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
  const productAmount =
    order.totalActualAmountCents ?? order.totalOriginAmountCents;
  const total = getBuyerErrandOrderAmountCents(order);
  const adjustment = getBuyerErrandOrderAdjustmentCents(order);

  return (
    <Card>
      <CardHeader>
        <CardTitle>金额汇总</CardTitle>
        <CardDescription>待支付时以账单金额为准</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">
            {order.totalActualAmountCents === null
              ? "预估商品金额"
              : "商品金额"}
          </dt>
          <dd>{formatPrice(productAmount)}</dd>
          <dt className="text-muted-foreground">跑腿费</dt>
          <dd>{formatPrice(order.totalServiceFeeCents)}</dd>
          {adjustment !== 0 ? (
            <>
              <dt className="text-muted-foreground">
                {adjustment < 0 ? "优惠及调整" : "包装费及调整"}
              </dt>
              <dd>
                {adjustment < 0
                  ? `-${formatPrice(Math.abs(adjustment))}`
                  : formatPrice(adjustment)}
              </dd>
            </>
          ) : null}
          <dt className="pt-2 font-medium">合计</dt>
          <dd className="pt-2 text-base font-semibold text-primary">
            {formatPrice(total)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function BillCard({ bill }: { bill: PaymentBill }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>支付账单</CardTitle>
        <CardDescription>{bill.billNo || `账单 #${bill.id}`}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">账单状态</span>
          <Badge variant={getBillBadgeVariant(bill.status)}>
            {getBillStatusLabel(bill.status)}
          </Badge>
        </div>
        <Separator />
        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">收款人</dt>
          <dd className="min-w-0 truncate text-right">
            {bill.payee?.name || "信息缺失"}
          </dd>
          <dt className="text-muted-foreground">付款标识码</dt>
          <dd className="break-all text-right font-mono font-semibold">
            {bill.verifyCode || "未生成"}
          </dd>
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

function TimelineDrawer({
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>关键时间</DrawerTitle>
          <DrawerDescription className="sr-only">
            查看跑腿订单的关键时间节点
          </DrawerDescription>
        </DrawerHeader>
        <div className="app-scrollbar flex max-h-[60dvh] flex-col overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {timeline.length === 0 ? (
            <Alert>
              <RiFileList3Line />
              <AlertTitle>暂无时间记录</AlertTitle>
              <AlertDescription>
                当前状态为{getStatusLabel(order.status)}，后续进度会在这里更新。
              </AlertDescription>
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
                <div className="min-w-0 pb-4">
                  <p className="font-medium">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(item.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function getBillStatusLabel(status: PaymentBill["status"]): string {
  if (status === "unpaid") return "待支付";
  if (status === "submitted") return "待确认收款";
  if (status === "completed") return "已完成";
  if (status === "closed") return "已关闭";
  return "状态未知";
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

function formatDateTime(value: string | null): string {
  if (!value) return "暂无";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getAvatarFallback(name: string): string {
  return name.trim().slice(0, 1) || "团";
}
