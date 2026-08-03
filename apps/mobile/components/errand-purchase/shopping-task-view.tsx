"use client";

import { type PointerEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftDoubleLine,
  RiArrowRightDoubleLine,
  RiCheckboxBlankLine,
  RiCheckboxLine,
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
  formatPrice,
  groupShoppingTaskItems,
  type ShoppingProductTaskGroup,
} from "@sast-shop/domain";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { Textarea } from "@workspace/ui/components/textarea";
import { toast } from "sonner";

import { ManagedImage } from "@/components/managed-image";
import { MobileFixedFooter } from "@/components/mobile-fixed-footer";

export type ShoppingTaskViewProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  detail: ShoppingTaskDetail;
  taskUpdatedAt: string | null;
};

type DialogState =
  | { type: "none" }
  | { type: "partial"; group: ShoppingProductTaskGroup<ShoppingTaskItem> }
  | { type: "skip"; group: ShoppingProductTaskGroup<ShoppingTaskItem> }
  | { type: "confirm_complete" }
  | { type: "confirm_cancel" };

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return "";
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isPurchased(
  group: ShoppingProductTaskGroup<ShoppingTaskItem>,
): boolean {
  return group.purchasedQuantity !== null;
}

function getStatusIcon(
  group: ShoppingProductTaskGroup<ShoppingTaskItem>,
) {
  if (group.purchasedQuantity === null) return null;
  if (group.purchasedQuantity === 0)
    return <RiCloseCircleLine className="size-5 text-destructive" />;
  if (group.purchasedQuantity < group.requiredQuantity)
    return <RiIndeterminateCircleLine className="size-5 text-primary" />;
  return <RiCheckboxLine className="size-5 text-primary" />;
}

export function ShoppingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
  taskUpdatedAt,
}: ShoppingTaskViewProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [items, setItems] = useState<ShoppingTaskItem[]>(detail.taskItems);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [partialQty, setPartialQty] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const serviceOptions = { dataSource, connectBaseUrl };
  const productGroups = groupShoppingTaskItems(items);

  const unprocessed = productGroups.filter((group) => !isPurchased(group));
  const processed = productGroups.filter((group) => isPurchased(group));
  const allDone = unprocessed.length === 0;

  const totalProductCents = productGroups.reduce((sum, group) => {
    if (group.purchasedQuantity === null || group.purchasedQuantity === 0) {
      return sum;
    }
    return sum + group.productAmountCents;
  }, 0);
  const refreshItems = async () => {
    const refreshed = await getShoppingTaskDetail(detail.taskId, serviceOptions);
    setItems(refreshed.taskItems);
  };

  const handleSave = async (
    group: ShoppingProductTaskGroup<ShoppingTaskItem>,
    purchasedQuantity: number,
    nonPurchaseReason?: string,
  ) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
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
            nonPurchaseReason:
              allocation.purchasedQuantity === 0
                ? nonPurchaseReason ?? null
                : null,
            itemUpdatedAt: allocation.item.updatedAt,
          },
          serviceOptions,
        );
      }
      await refreshItems();
      setDialog({ type: "none" });
    } catch {
      toast.error("保存失败，请稍后再试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleRevoke = async (group: ShoppingProductTaskGroup<ShoppingTaskItem>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const allocations = allocateShoppingProductPurchase(group, -1);
      for (const allocation of allocations) {
        await saveShoppingTaskItem(
          {
            errandTaskId: detail.taskId,
            errandTaskItemId: allocation.item.id,
            purchasedQuantity: allocation.purchasedQuantity,
            nonPurchaseReason: null,
            itemUpdatedAt: allocation.item.updatedAt,
          },
          serviceOptions,
        );
      }
      await refreshItems();
    } catch {
      toast.error("撤销失败，请稍后再试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await transitionToPendingDistributing(
        detail.taskId,
        taskUpdatedAt,
        serviceOptions,
      );
      setDialog({ type: "none" });
      router.refresh();
    } catch {
      toast.error("操作失败，请稍后再试");
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await cancelTask(detail.taskId, taskUpdatedAt, serviceOptions);
      setDialog({ type: "none" });
      router.push("/group");
    } catch {
      toast.error("取消失败，请稍后再试");
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-5 pb-24">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-7">
            {detail.storeName}
          </h1>
          <p className="text-sm text-muted-foreground">采购中</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          aria-label="取消采购"
          title="取消采购"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={() => setDialog({ type: "confirm_cancel" })}
        >
          <RiCloseCircleLine />
        </Button>
      </section>

      {unprocessed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">待采购</h2>
            <span className="text-xs text-muted-foreground">
              {unprocessed.length} 种商品
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {unprocessed.map((group) => (
              <ShoppingItemCard
                key={group.id}
                group={group}
                open={openActionId === group.id}
                onOpenChange={(open) => setOpenActionId(open ? group.id : null)}
                onBuyAll={() => {
                  setOpenActionId(null);
                  void handleSave(group, group.requiredQuantity);
                }}
                onBuyPartial={() => {
                  setOpenActionId(null);
                  setPartialQty("");
                  setDialog({ type: "partial", group });
                }}
                onSkip={() => {
                  setOpenActionId(null);
                  setSkipReason("");
                  setDialog({ type: "skip", group });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {processed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">已记录</h2>
            <span className="text-xs text-muted-foreground">
              {processed.length} 种商品
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {processed.map((group) => (
              <ProcessedShoppingCard
                key={group.id}
                group={group}
                onRevoke={() => handleRevoke(group)}
              />
            ))}
          </div>
        </section>
      )}

      <MobileFixedFooter>
        <Button
          type="button"
          disabled={!allDone}
          className="h-12 w-full"
          onClick={() => setDialog({ type: "confirm_complete" })}
        >
          {allDone ? "确认完成采购" : `还有 ${unprocessed.length} 种商品待处理`}
        </Button>
      </MobileFixedFooter>

      <ResponsiveDialog
        open={dialog.type === "partial"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>部分购买</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "partial"
                ? `输入实际购买数量（1 ~ ${dialog.group.requiredQuantity - 1}）`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {dialog.type === "partial" && (
            <Field>
              <FieldLabel
                htmlFor="partial-purchase-quantity"
                className="sr-only"
              >
                实际购买数量
              </FieldLabel>
              <Input
                id="partial-purchase-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={dialog.group.requiredQuantity - 1}
                value={partialQty}
                onChange={(e) => setPartialQty(e.target.value)}
                placeholder="购买数量"
              />
            </Field>
          )}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={
                dialog.type !== "partial" ||
                !partialQty ||
                !Number.isInteger(Number(partialQty)) ||
                Number(partialQty) < 1 ||
                Number(partialQty) >= dialog.group.requiredQuantity
              }
              onClick={() => {
                if (dialog.type !== "partial") return;
                void handleSave(dialog.group, Number(partialQty));
              }}
            >
              确认
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "skip"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>不购买</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              可选填不购买原因（最多 15 字）
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Field>
            <FieldLabel htmlFor="skip-purchase-reason" className="sr-only">
              不购买原因
            </FieldLabel>
            <Textarea
              id="skip-purchase-reason"
              maxLength={15}
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="不购买原因（可选）"
              rows={3}
            />
          </Field>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (dialog.type !== "skip") return;
                void handleSave(dialog.group, 0, skipReason || undefined);
              }}
            >
              确认不购买
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
            <ResponsiveDialogTitle>确认完成采购</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              确认采购结果
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Card>
            <CardContent className="flex flex-col gap-2 p-3 text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">商品费合计</span>
                <span className="font-medium">
                  {formatPrice(totalProductCents)}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                跑腿费与包装费将在生成收款账单后计算。
              </p>
            </CardContent>
          </Card>
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
              disabled={submitting}
              onClick={() => void handleComplete()}
            >
              {submitting ? "提交中" : "确认"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "confirm_cancel"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>取消采购</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              确认取消此次采购任务？此操作不可撤销。
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
              variant="destructive"
              disabled={submitting}
              onClick={() => void handleCancel()}
            >
              {submitting ? "取消中" : "确认取消"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function ShoppingItemCard({
  group,
  open,
  onOpenChange,
  onBuyAll,
  onBuyPartial,
  onSkip,
}: {
  group: ShoppingProductTaskGroup<ShoppingTaskItem>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyAll: () => void;
  onBuyPartial: () => void;
  onSkip: () => void;
}) {
  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const swipedRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipedRef.current = false;
    pointerStartXRef.current = event.clientX;
    pointerStartYRef.current = event.clientY;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (
      pointerStartXRef.current === null ||
      pointerStartYRef.current === null
    ) {
      return;
    }

    const deltaX = event.clientX - pointerStartXRef.current;
    const deltaY = event.clientY - pointerStartYRef.current;
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;

    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    swipedRef.current = true;
    onOpenChange(deltaX < 0);
  };

  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-card sm:overflow-visible sm:border-0 sm:bg-transparent"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartXRef.current = null;
        pointerStartYRef.current = null;
      }}
    >
      <div
        className={`absolute inset-y-0 right-0 z-20 grid overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none sm:hidden ${
          group.requiredQuantity > 1
            ? "w-[156px] grid-cols-3"
            : "w-[104px] grid-cols-2"
        } ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <Button
          type="button"
          className="h-full min-w-0 rounded-none px-0"
          tabIndex={open ? 0 : -1}
          aria-label="全部购买"
          title="全部购买"
          onClick={onBuyAll}
        >
          <RiCheckboxLine className="size-6" />
        </Button>
        {group.requiredQuantity > 1 ? (
          <Button
            type="button"
            variant="secondary"
            className="h-full min-w-0 rounded-none px-0"
            tabIndex={open ? 0 : -1}
            aria-label="部分购买"
            title="部分购买"
            onClick={onBuyPartial}
          >
            <RiIndeterminateCircleLine className="size-6" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          className="h-full min-w-0 rounded-none px-0"
          tabIndex={open ? 0 : -1}
          aria-label="不购买"
          title="不购买"
          onClick={onSkip}
        >
          <RiCloseCircleLine className="size-6" />
        </Button>
      </div>

      <div className="relative z-10 flex touch-pan-y items-center gap-3 rounded-lg bg-card p-3 sm:border">
        <ManagedImage
          src={group.productImageUrl}
          alt={group.productTitle}
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-5">
            {group.productTitle}
          </p>
          {group.productDescription ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {group.productDescription}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            需 {group.requiredQuantity} 件
            {group.purchasedQuantity !== null ? (
              <span className="ml-2">实际 {group.purchasedQuantity} 件</span>
            ) : null}
            {group.earliestDeadline ? (
              <span className="ml-2">
                截止时间 {formatDeadline(group.earliestDeadline)}
                {group.deadlineCount > 1 ? " 起" : ""}
              </span>
            ) : null}
          </p>
          {group.deadlineCount > 1 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              含 {group.deadlineCount} 个截止时间
            </p>
          ) : null}
        </div>
        <div className="hidden shrink-0 flex-col gap-1.5 sm:flex">
          <Button type="button" size="sm" onClick={onBuyAll}>
            全部购买
          </Button>
          {group.requiredQuantity > 1 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onBuyPartial}
            >
              部分购买
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onSkip}
          >
            不购买
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          className={`shrink-0 text-muted-foreground transition-opacity sm:hidden ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
          tabIndex={open ? -1 : 0}
          aria-label={`${open ? "收起" : "展开"}${group.productTitle}的采购操作`}
          aria-expanded={open}
          onClick={() => {
            if (swipedRef.current) {
              swipedRef.current = false;
              return;
            }
            onOpenChange(!open);
          }}
        >
          {open ? (
            <RiArrowRightDoubleLine className="size-5" />
          ) : (
            <RiArrowLeftDoubleLine className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function ProcessedShoppingCard({
  group,
  onRevoke,
}: {
  group: ShoppingProductTaskGroup<ShoppingTaskItem>;
  onRevoke: () => void;
}) {
  const icon = getStatusIcon(group);
  const statusText =
    group.purchasedQuantity === 0
      ? `不购买${group.nonPurchaseReason ? `：${group.nonPurchaseReason}` : ""}`
      : group.purchasedQuantity !== null &&
          group.purchasedQuantity < group.requiredQuantity
        ? `部分购买：${group.purchasedQuantity}/${group.requiredQuantity} 件`
        : `全部购买：${group.purchasedQuantity} 件`;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 opacity-75">
      <Button
        type="button"
        variant="ghost"
        size="icon-touch"
        className="shrink-0"
        aria-label="撤销采购结果"
        onClick={onRevoke}
      >
        {icon ?? <RiCheckboxBlankLine className="size-5" />}
      </Button>
      <ManagedImage
        src={group.productImageUrl}
        alt={group.productTitle}
        className="size-14 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-5">
          {group.productTitle}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{statusText}</p>
        {group.earliestDeadline ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            截止时间 {formatDeadline(group.earliestDeadline)}
            {group.deadlineCount > 1 ? " 起" : ""}
          </p>
        ) : null}
        {group.deadlineCount > 1 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            含 {group.deadlineCount} 个截止时间
          </p>
        ) : null}
      </div>
    </div>
  );
}
