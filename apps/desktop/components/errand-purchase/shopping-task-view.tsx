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
import {
  allocateShoppingProductPurchase,
  groupShoppingTaskItems,
  type ShoppingProductTaskGroup,
} from "@sast-shop/domain";
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
  | { type: "partial"; group: ShoppingProductTaskGroup<ShoppingTaskItem> }
  | { type: "skip"; group: ShoppingProductTaskGroup<ShoppingTaskItem> }
  | { type: "complete" }
  | { type: "cancel" };

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return "";
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ShoppingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
  taskUpdatedAt,
}: {
  dataSource: DataSource;
  connectBaseUrl?: string;
  detail: ShoppingTaskDetail;
  taskUpdatedAt: string | null;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [items, setItems] = useState(detail.taskItems);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [partialQuantity, setPartialQuantity] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [pending, setPending] = useState(false);
  const serviceOptions = { dataSource, connectBaseUrl };
  const productGroups = groupShoppingTaskItems(items);
  const processedCount = productGroups.filter(
    (group) => group.purchasedQuantity !== null,
  ).length;
  const pendingGroups = productGroups.filter(
    (group) => group.purchasedQuantity === null,
  );
  const processedGroups = productGroups.filter(
    (group) => group.purchasedQuantity !== null,
  );
  const purchasedGroups = processedGroups.filter(
    (group) => (group.purchasedQuantity ?? 0) > 0,
  );
  const purchasedQuantity = purchasedGroups.reduce(
    (total, group) => total + (group.purchasedQuantity ?? 0),
    0,
  );
  const allProcessed =
    processedCount === productGroups.length && productGroups.length > 0;

  async function saveGroup(
    group: ShoppingProductTaskGroup<ShoppingTaskItem>,
    purchasedQuantity: number,
    nonPurchaseReason: string | null = null,
  ) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const allocations = allocateShoppingProductPurchase(
        group,
        purchasedQuantity,
      );
      for (const allocation of allocations) {
        await saveShoppingTaskItem(
          {
            errandTaskId: detail.taskId,
            errandTaskItemId: allocation.item.id,
            purchasedQuantity: allocation.purchasedQuantity,
            nonPurchaseReason,
            itemUpdatedAt: allocation.item.updatedAt,
          },
          serviceOptions,
        );
      }
      const refreshed = await getShoppingTaskDetail(
        detail.taskId,
        serviceOptions,
      );
      setItems(refreshed.taskItems);
      setDialog({ type: "none" });
      toast.success(
        purchasedQuantity === -1 ? "已撤销采购结果" : "采购结果已保存",
      );
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
        taskUpdatedAt,
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
      await cancelTask(detail.taskId, taskUpdatedAt, serviceOptions);
      toast.success("采购任务已取消");
      router.push("/orders?type=errand&view=captain");
    } catch {
      toast.error("取消失败，请刷新任务后重试");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function renderItemGroup(
    title: string,
    description: string,
    groups: ShoppingProductTaskGroup<ShoppingTaskItem>[],
  ) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="neutral">{groups.length} 种</Badge>
        </div>
        {groups.length ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {groups.map((group) => (
              <ShoppingItemCard
                key={group.id}
                group={group}
                disabled={pending}
                onBuyAll={() => void saveGroup(group, group.requiredQuantity)}
                onBuyPartial={() => {
                  setPartialQuantity("");
                  setDialog({ type: "partial", group });
                }}
                onSkip={() => {
                  setSkipReason("");
                  setDialog({ type: "skip", group });
                }}
                onRevoke={() => void saveGroup(group, -1)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              当前没有{title}商品。
            </CardContent>
          </Card>
        )}
      </section>
    );
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
              {processedCount} 种已记录 · 共 {productGroups.length} 种
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

      {renderItemGroup(
        "待处理",
        "请记录全部购买、部分购买或不购买。",
        pendingGroups,
      )}
      {renderItemGroup(
        "已处理",
        "已保存的采购结果将在下一阶段用于核对价格和分发。",
        processedGroups,
      )}

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
                ? `请输入 1 到 ${Math.max(1, dialog.group.requiredQuantity - 1)} 之间的实际数量。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="实际购买数量"
            type="number"
            min={1}
            max={
              dialog.type === "partial" ? dialog.group.requiredQuantity - 1 : 1
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
                  dialog.type === "partial"
                    ? dialog.group.requiredQuantity
                    : 0,
                )
              }
              onClick={() =>
                dialog.type === "partial" &&
                void saveGroup(dialog.group, Number(partialQuantity))
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
                void saveGroup(dialog.group, 0, skipReason.trim() || null)
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
        description={`已记录 ${processedCount} 种，实际采购 ${purchasedGroups.length} 种、${purchasedQuantity} 件。完成后进入实际价格与分发设置。`}
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
  group,
  disabled,
  onBuyAll,
  onBuyPartial,
  onSkip,
  onRevoke,
}: {
  group: ShoppingProductTaskGroup<ShoppingTaskItem>;
  disabled: boolean;
  onBuyAll: () => void;
  onBuyPartial: () => void;
  onSkip: () => void;
  onRevoke: () => void;
}) {
  const processed = group.purchasedQuantity !== null;
  const status =
    group.purchasedQuantity === null
      ? "待处理"
      : group.purchasedQuantity === 0
        ? "未购买"
        : group.purchasedQuantity < group.requiredQuantity
          ? "部分购买"
          : "已购买";
  const Icon =
    group.purchasedQuantity === 0
      ? RiCloseCircleLine
      : group.purchasedQuantity !== null &&
          group.purchasedQuantity < group.requiredQuantity
        ? RiIndeterminateCircleLine
        : RiCheckboxCircleLine;
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start gap-4">
        <ManagedImage
          src={group.productImageUrl}
          alt={group.productTitle}
          className="size-20 shrink-0 rounded-lg border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <CardTitle className="truncate text-base">
              {group.productTitle}
            </CardTitle>
            <Badge
              variant={
                processed
                  ? group.purchasedQuantity === 0
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
          {group.productDescription ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {group.productDescription}
            </p>
          ) : null}
          <p className="mt-3 text-sm">
            需求 {group.requiredQuantity} 件
            {group.purchasedQuantity !== null ? (
              <span className="ml-2">实际采购 {group.purchasedQuantity} 件</span>
            ) : null}
            {group.earliestDeadline ? (
              <span className="ml-2">
                截止时间 {formatDeadline(group.earliestDeadline)}
                {group.deadlineCount > 1 ? " 起" : ""}
              </span>
            ) : null}
          </p>
          {group.deadlineCount > 1 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              含 {group.deadlineCount} 个截止时间，后续仍按需求明细分发。
            </p>
          ) : null}
          {group.nonPurchaseReason ? (
            <p className="mt-2 text-sm text-destructive">
              原因：{group.nonPurchaseReason}
            </p>
          ) : null}
        </div>
      </CardHeader>
      {processed ? (
        <CardContent className="flex justify-end border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onRevoke}
          >
            撤销处理结果
          </Button>
        </CardContent>
      ) : (
        <CardContent className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || group.requiredQuantity <= 1}
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
