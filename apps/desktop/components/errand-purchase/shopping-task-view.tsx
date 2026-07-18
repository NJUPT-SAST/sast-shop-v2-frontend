"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiIndeterminateCircleLine,
} from "@remixicon/react";
import {
  cancelTask,
  getShoppingTaskDetail,
  saveShoppingTaskItem,
  transitionToPendingDistributing,
  type DataSource,
  type ShoppingTaskDetail,
  type ShoppingTaskItem,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { toast } from "sonner";

import { ManagedImage } from "@/components/managed-image";

type DialogState =
  | { type: "none" }
  | { type: "partial"; item: ShoppingTaskItem }
  | { type: "skip"; item: ShoppingTaskItem }
  | { type: "complete" }
  | { type: "cancel" };

export function ShoppingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
}: {
  dataSource: DataSource;
  connectBaseUrl?: string;
  detail: ShoppingTaskDetail;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [items, setItems] = useState(detail.taskItems);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [partialQuantity, setPartialQuantity] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [pending, setPending] = useState(false);
  const serviceOptions = { dataSource, connectBaseUrl };
  const processedCount = items.filter(
    (item) => item.purchasedQuantity !== null,
  ).length;
  const allProcessed = processedCount === items.length && items.length > 0;
  const productAmount = items.reduce(
    (total, item) =>
      total + item.actualUnitPriceCents * (item.purchasedQuantity ?? 0),
    0,
  );

  async function saveItem(
    item: ShoppingTaskItem,
    purchasedQuantity: number,
    nonPurchaseReason: string | null = null,
  ) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await saveShoppingTaskItem(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.id,
          purchasedQuantity,
          nonPurchaseReason,
          itemUpdatedAt: item.updatedAt,
        },
        serviceOptions,
      );
      const refreshed = await getShoppingTaskDetail(
        detail.taskId,
        serviceOptions,
      );
      setItems(refreshed.taskItems);
      setDialog({ type: "none" });
      toast.success("采购结果已保存");
    } catch {
      toast.error("保存失败，任务状态可能已变化");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function completeShopping() {
    if (!allProcessed || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await transitionToPendingDistributing(
        detail.taskId,
        null,
        serviceOptions,
      );
      setDialog({ type: "none" });
      toast.success("采购阶段已完成");
      router.refresh();
    } catch {
      toast.error("状态更新失败，请刷新任务后重试");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function cancelShopping() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await cancelTask(detail.taskId, null, serviceOptions);
      toast.success("采购任务已取消");
      router.push("/orders?type=errand&view=captain");
    } catch {
      toast.error("取消失败，请刷新任务后重试");
    } finally {
      pendingRef.current = false;
      setPending(false);
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
            <h1 className="text-3xl font-semibold tracking-tight">
              {detail.storeName}
            </h1>
            <Badge variant="warning">采购中</Badge>
          </div>
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          onClick={() => setDialog({ type: "cancel" })}
        >
          取消采购任务
        </Button>
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm text-muted-foreground">处理进度</p>
            <p className="mt-1 text-lg font-semibold">
              {processedCount} 种已记录 · 共 {items.length} 种
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">当前商品金额</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {formatPrice(productAmount)}
            </p>
          </div>
          <Button
            disabled={!allProcessed || pending}
            onClick={() => setDialog({ type: "complete" })}
          >
            <RiCheckboxCircleLine data-icon="inline-start" />
            完成采购阶段
          </Button>
        </CardContent>
      </Card>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        {items.map((item) => (
          <ShoppingItemCard
            key={item.id}
            item={item}
            disabled={pending}
            onBuyAll={() => void saveItem(item, item.requiredQuantity)}
            onBuyPartial={() => {
              setPartialQuantity("");
              setDialog({ type: "partial", item });
            }}
            onSkip={() => {
              setSkipReason("");
              setDialog({ type: "skip", item });
            }}
          />
        ))}
      </section>

      <Dialog
        open={dialog.type === "partial"}
        onOpenChange={(open) =>
          !open && !pending && setDialog({ type: "none" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录部分购买</DialogTitle>
            <DialogDescription>
              {dialog.type === "partial"
                ? `请输入 1 到 ${Math.max(1, dialog.item.requiredQuantity - 1)} 之间的实际数量。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="实际购买数量"
            type="number"
            min={1}
            max={
              dialog.type === "partial" ? dialog.item.requiredQuantity - 1 : 1
            }
            value={partialQuantity}
            onChange={(event) => setPartialQuantity(event.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ type: "none" })}
              disabled={pending}
            >
              取消
            </Button>
            <Button
              disabled={
                pending ||
                dialog.type !== "partial" ||
                !isValidPartialQuantity(
                  partialQuantity,
                  dialog.type === "partial" ? dialog.item.requiredQuantity : 0,
                )
              }
              onClick={() =>
                dialog.type === "partial" &&
                void saveItem(dialog.item, Number(partialQuantity))
              }
            >
              {pending ? <Spinner /> : null}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog.type === "skip"}
        onOpenChange={(open) =>
          !open && !pending && setDialog({ type: "none" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录未购买</DialogTitle>
            <DialogDescription>
              可选填不购买原因（最多 15 字），参与者会在订单明细中看到。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="不购买原因"
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
            maxLength={15}
            placeholder="例如：门店缺货"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ type: "none" })}
              disabled={pending}
            >
              取消
            </Button>
            <Button
              disabled={pending || dialog.type !== "skip"}
              onClick={() =>
                dialog.type === "skip" &&
                void saveItem(dialog.item, 0, skipReason.trim() || null)
              }
            >
              {pending ? <Spinner /> : null}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={dialog.type === "complete"}
        title="完成采购"
        description="所有商品的采购结果都已记录。完成后进入实际价格与分发设置。"
        confirmLabel="完成采购"
        pending={pending}
        onCancel={() => setDialog({ type: "none" })}
        onConfirm={completeShopping}
      />
      <ConfirmationDialog
        open={dialog.type === "cancel"}
        title="取消采购任务"
        description="取消后该任务不会继续分发和收款，请谨慎操作。"
        confirmLabel="取消采购"
        pending={pending}
        destructive
        onCancel={() => setDialog({ type: "none" })}
        onConfirm={cancelShopping}
      />
    </div>
  );
}

function ShoppingItemCard({
  item,
  disabled,
  onBuyAll,
  onBuyPartial,
  onSkip,
}: {
  item: ShoppingTaskItem;
  disabled: boolean;
  onBuyAll: () => void;
  onBuyPartial: () => void;
  onSkip: () => void;
}) {
  const processed = item.purchasedQuantity !== null;
  const status =
    item.purchasedQuantity === null
      ? "待处理"
      : item.purchasedQuantity === 0
        ? "未购买"
        : item.purchasedQuantity < item.requiredQuantity
          ? "部分购买"
          : "已购买";
  const Icon =
    item.purchasedQuantity === 0
      ? RiCloseCircleLine
      : item.purchasedQuantity !== null &&
          item.purchasedQuantity < item.requiredQuantity
        ? RiIndeterminateCircleLine
        : RiCheckboxCircleLine;
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start gap-4">
        <ManagedImage
          src={item.productImageUrl}
          alt={item.productTitle}
          className="size-20 shrink-0 rounded-lg border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <CardTitle className="truncate text-base">
              {item.productTitle}
            </CardTitle>
            <Badge
              variant={
                processed
                  ? item.purchasedQuantity === 0
                    ? "danger"
                    : "success"
                  : "neutral"
              }
              className="shrink-0"
            >
              {processed ? <Icon className="size-3.5" /> : null}
              {status}
            </Badge>
          </div>
          {item.productDescription ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.productDescription}
            </p>
          ) : null}
          <p className="mt-3 text-sm">
            需求 {item.requiredQuantity} 件 · 参考单价{" "}
            {formatPrice(item.actualUnitPriceCents)}
          </p>
          {item.nonPurchaseReason ? (
            <p className="mt-2 text-sm text-destructive">
              原因：{item.nonPurchaseReason}
            </p>
          ) : null}
        </div>
      </CardHeader>
      {processed ? null : (
        <CardContent className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || item.requiredQuantity <= 1}
            onClick={onBuyPartial}
          >
            部分购买
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="text-destructive"
            onClick={onSkip}
          >
            不购买
          </Button>
          <Button size="sm" disabled={disabled} onClick={onBuyAll}>
            全部购买
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !pending && onCancel()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            返回检查
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isValidPartialQuantity(value: string, required: number): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < required;
}
