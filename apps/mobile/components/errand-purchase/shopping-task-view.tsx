"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
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
import { formatPrice } from "@sast-shop/domain";
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
import {
  compareUpdatedAt,
  latestUpdatedAt,
  mergeShoppingTaskItems,
} from "@/lib/errand-recovery";
import { getShoppingProductTotalCents } from "@/lib/shopping-task-summary";

export type ShoppingTaskViewProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  detail: ShoppingTaskDetail;
  taskUpdatedAt: string | null;
};

type DialogState =
  | { type: "none" }
  | { type: "partial"; item: ShoppingTaskItem }
  | { type: "skip"; item: ShoppingTaskItem }
  | { type: "confirm_complete" }
  | { type: "confirm_cancel" };

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return "";
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isPurchased(item: ShoppingTaskItem): boolean {
  return item.purchasedQuantity !== null;
}

function getStatusIcon(item: ShoppingTaskItem) {
  if (item.purchasedQuantity === null) return null;
  if (item.purchasedQuantity === 0)
    return <RiCloseCircleLine className="size-5 text-destructive" />;
  if (item.purchasedQuantity < item.requiredQuantity)
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
  const [taskVersion, setTaskVersion] = useState(
    latestUpdatedAt(taskUpdatedAt, detail.taskUpdatedAt),
  );
  const [unverifiedTaskVersion, setUnverifiedTaskVersion] = useState<
    string | null | undefined
  >();
  const taskNeedsVerification =
    unverifiedTaskVersion !== undefined &&
    compareUpdatedAt(taskVersion, unverifiedTaskVersion) <= 0;
  useEffect(() => {
    const incomingVersion = latestUpdatedAt(
      taskUpdatedAt,
      detail.taskUpdatedAt,
    );
    if (compareUpdatedAt(incomingVersion, taskVersion) >= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems((current) =>
        mergeShoppingTaskItems(
          current,
          detail.taskItems,
          compareUpdatedAt(incomingVersion, taskVersion) > 0,
        ),
      );
    }
    setTaskVersion((current) => latestUpdatedAt(current, incomingVersion));
  }, [detail.taskItems, detail.taskUpdatedAt, taskUpdatedAt, taskVersion]);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [partialQty, setPartialQty] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const serviceOptions = { dataSource, connectBaseUrl };

  const unprocessed = items.filter((i) => !isPurchased(i));
  const processed = items.filter((i) => isPurchased(i));
  const allDone = unprocessed.length === 0;

  const totalProductCents = getShoppingProductTotalCents(items);
  const updateItem = (updated: ShoppingTaskItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleSave = async (
    item: ShoppingTaskItem,
    purchasedQuantity: number,
    nonPurchaseReason?: string,
  ) => {
    if (submittingRef.current || taskNeedsVerification) {
      toast.info("正在处理，请稍候");
      return;
    }
    submittingRef.current = true;
    setPendingItemId(item.id);
    try {
      await saveShoppingTaskItem(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.id,
          purchasedQuantity,
          nonPurchaseReason: nonPurchaseReason ?? null,
          itemUpdatedAt: item.updatedAt,
        },
        serviceOptions,
      );
      updateItem({
        ...item,
        purchasedQuantity,
        nonPurchaseReason: nonPurchaseReason ?? null,
      });
      if (dataSource === "local") {
        try {
          const refreshed = await getShoppingTaskDetail(
            detail.taskId,
            serviceOptions,
          );
          if (compareUpdatedAt(refreshed.taskUpdatedAt, taskVersion) >= 0) {
            setItems((current) =>
              mergeShoppingTaskItems(
                current,
                refreshed.taskItems,
                compareUpdatedAt(refreshed.taskUpdatedAt, taskVersion) > 0,
              ),
            );
          }
          setTaskVersion((current) =>
            latestUpdatedAt(current, refreshed.taskUpdatedAt),
          );
        } catch {
          toast.warning("结果已保存，但状态刷新失败，请重新进入任务");
        }
      }
      setDialog({ type: "none" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请稍后再试",
      );
    } finally {
      submittingRef.current = false;
      setPendingItemId(null);
    }
  };

  const handleRevoke = async (item: ShoppingTaskItem) => {
    if (submittingRef.current || taskNeedsVerification) {
      toast.info("正在处理，请稍候");
      return;
    }
    submittingRef.current = true;
    setPendingItemId(item.id);
    try {
      await saveShoppingTaskItem(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.id,
          purchasedQuantity: -1,
          nonPurchaseReason: null,
          itemUpdatedAt: item.updatedAt,
        },
        serviceOptions,
      );
      updateItem({ ...item, purchasedQuantity: null, nonPurchaseReason: null });
      if (dataSource === "local") {
        try {
          const refreshed = await getShoppingTaskDetail(
            detail.taskId,
            serviceOptions,
          );
          if (compareUpdatedAt(refreshed.taskUpdatedAt, taskVersion) >= 0) {
            setItems((current) =>
              mergeShoppingTaskItems(
                current,
                refreshed.taskItems,
                compareUpdatedAt(refreshed.taskUpdatedAt, taskVersion) > 0,
              ),
            );
          }
          setTaskVersion((current) =>
            latestUpdatedAt(current, refreshed.taskUpdatedAt),
          );
        } catch {
          toast.warning("结果已撤销，但状态刷新失败，请重新进入任务");
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "撤销失败，请稍后再试",
      );
    } finally {
      submittingRef.current = false;
      setPendingItemId(null);
    }
  };

  const handleComplete = async () => {
    if (submittingRef.current || taskNeedsVerification) {
      toast.info("正在处理，请稍候");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await transitionToPendingDistributing(
        detail.taskId,
        taskVersion,
        serviceOptions,
      );
      setDialog({ type: "none" });
      router.refresh();
    } catch {
      toast.error("操作失败，请稍后再试");
      setUnverifiedTaskVersion(taskVersion);
      setDialog({ type: "none" });
      setSubmitting(false);
      router.refresh();
    } finally {
      submittingRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (submittingRef.current || taskNeedsVerification) {
      toast.info("正在处理，请稍候");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await cancelTask(detail.taskId, taskVersion, serviceOptions);
      setDialog({ type: "none" });
      router.push("/group");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "取消失败，请稍后再试",
      );
      setUnverifiedTaskVersion(taskVersion);
      setDialog({ type: "none" });
      setSubmitting(false);
      router.refresh();
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
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
          disabled={
            pendingItemId !== null || submitting || taskNeedsVerification
          }
          onClick={() => setDialog({ type: "confirm_cancel" })}
        >
          <RiCloseCircleLine />
        </Button>
      </section>

      {taskNeedsVerification ? (
        <p
          role="status"
          className="rounded-lg border px-3 py-2 text-sm text-muted-foreground"
        >
          任务状态待核实，请重新进入任务查看最新结果后再操作。
        </p>
      ) : null}

      {unprocessed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">待采购</h2>
            <span className="text-xs text-muted-foreground">
              {unprocessed.length} 种商品
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {unprocessed.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                disabled={
                  pendingItemId !== null || submitting || taskNeedsVerification
                }
                saving={pendingItemId === item.id}
                open={openActionId === item.id}
                onOpenChange={(open) => setOpenActionId(open ? item.id : null)}
                onBuyAll={() => {
                  setOpenActionId(null);
                  void handleSave(item, item.requiredQuantity);
                }}
                onBuyPartial={() => {
                  setOpenActionId(null);
                  setPartialQty("");
                  setDialog({ type: "partial", item });
                }}
                onSkip={() => {
                  setOpenActionId(null);
                  setSkipReason("");
                  setDialog({ type: "skip", item });
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
            {processed.map((item) => (
              <ProcessedShoppingCard
                key={item.id}
                item={item}
                disabled={
                  pendingItemId !== null || submitting || taskNeedsVerification
                }
                saving={pendingItemId === item.id}
                onRevoke={() => handleRevoke(item)}
              />
            ))}
          </div>
        </section>
      )}

      <MobileFixedFooter>
        <Button
          type="button"
          disabled={
            !allDone ||
            pendingItemId !== null ||
            submitting ||
            taskNeedsVerification
          }
          className="h-12 w-full"
          onClick={() => setDialog({ type: "confirm_complete" })}
        >
          {pendingItemId !== null
            ? "正在保存采购结果"
            : allDone
              ? "确认完成采购"
              : `还有 ${unprocessed.length} 种商品待处理`}
        </Button>
      </MobileFixedFooter>

      <ResponsiveDialog
        open={dialog.type === "partial"}
        onOpenChange={(open) => {
          if (!open && pendingItemId === null) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>部分购买</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "partial"
                ? `输入实际购买数量（1 ~ ${dialog.item.requiredQuantity - 1}）`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="min-h-0 overflow-y-auto">
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
                  disabled={pendingItemId !== null}
                  inputMode="numeric"
                  min={1}
                  max={dialog.item.requiredQuantity - 1}
                  value={partialQty}
                  onChange={(e) => setPartialQty(e.target.value)}
                  placeholder="购买数量"
                />
              </Field>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pendingItemId !== null}
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={
                dialog.type !== "partial" ||
                pendingItemId !== null ||
                !partialQty ||
                !Number.isInteger(Number(partialQty)) ||
                Number(partialQty) < 1 ||
                Number(partialQty) >= dialog.item.requiredQuantity
              }
              onClick={() => {
                if (dialog.type !== "partial") return;
                void handleSave(dialog.item, Number(partialQty));
              }}
            >
              {pendingItemId !== null ? "保存中" : "记录采购数量"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "skip"}
        onOpenChange={(open) => {
          if (!open && pendingItemId === null) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>不购买</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              可选填不购买原因（最多 15 字）
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="skip-purchase-reason" className="sr-only">
                不购买原因
              </FieldLabel>
              <Textarea
                id="skip-purchase-reason"
                maxLength={15}
                disabled={pendingItemId !== null}
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="不购买原因（可选）"
                rows={3}
              />
            </Field>
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pendingItemId !== null}
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={pendingItemId !== null}
              onClick={() => {
                if (dialog.type !== "skip") return;
                void handleSave(dialog.item, 0, skipReason || undefined);
              }}
            >
              {pendingItemId !== null ? "保存中" : "确认不购买"}
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
                  {totalProductCents === null
                    ? "待核算"
                    : formatPrice(totalProductCents)}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {totalProductCents === null
                  ? "部分商品尚未记录实际单价，商品费将在后续核算。"
                  : "跑腿费与包装费将在生成收款账单后计算。"}
              </p>
            </CardContent>
          </Card>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || taskNeedsVerification}
              onClick={() => setDialog({ type: "none" })}
            >
              返回
            </Button>
            <Button
              type="button"
              disabled={submitting || taskNeedsVerification}
              onClick={() => void handleComplete()}
            >
              {submitting ? "提交中" : "完成采购"}
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
              确认取消此次采购任务？相关需求会回到待接单状态。
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
  item,
  open,
  disabled,
  saving,
  onOpenChange,
  onBuyAll,
  onBuyPartial,
  onSkip,
}: {
  item: ShoppingTaskItem;
  open: boolean;
  disabled: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyAll: () => void;
  onBuyPartial: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <ManagedImage
          src={item.productImageUrl}
          alt={item.productTitle}
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-5">
            {item.productTitle}
          </p>
          {item.productDescription ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {item.productDescription}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            需 {item.requiredQuantity} 件
            {item.deadline ? (
              <span className="ml-2">
                截止时间 {formatDeadline(item.deadline)}
              </span>
            ) : null}
          </p>
          {saving ? (
            <p className="mt-1 text-xs text-primary" role="status">
              保存中，请稍候
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="touch"
        className="mt-2 w-full justify-between px-1 text-primary"
        aria-expanded={open}
        aria-controls={`shopping-actions-${item.id}`}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {open ? "收起采购操作" : "展开采购操作"}
        {open ? (
          <RiArrowUpSLine className="size-5" aria-hidden="true" />
        ) : (
          <RiArrowDownSLine className="size-5" aria-hidden="true" />
        )}
      </Button>
      <div
        id={`shopping-actions-${item.id}`}
        className={open ? "grid grid-cols-2 gap-2 pt-2" : "hidden"}
      >
        <Button
          type="button"
          size="touch"
          disabled={disabled}
          onClick={onBuyAll}
        >
          全部购买
        </Button>
        {item.requiredQuantity > 1 ? (
          <Button
            type="button"
            size="touch"
            variant="secondary"
            disabled={disabled}
            onClick={onBuyPartial}
          >
            部分购买
          </Button>
        ) : null}
        <Button
          type="button"
          size="touch"
          variant="destructive"
          className={item.requiredQuantity > 1 ? "col-span-2" : ""}
          disabled={disabled}
          onClick={onSkip}
        >
          不购买
        </Button>
      </div>
    </div>
  );
}

function ProcessedShoppingCard({
  item,
  disabled,
  saving,
  onRevoke,
}: {
  item: ShoppingTaskItem;
  disabled: boolean;
  saving: boolean;
  onRevoke: () => void;
}) {
  const icon = getStatusIcon(item);
  const statusText =
    item.purchasedQuantity === 0
      ? `不购买${item.nonPurchaseReason ? `：${item.nonPurchaseReason}` : ""}`
      : item.purchasedQuantity !== null &&
          item.purchasedQuantity < item.requiredQuantity
        ? `部分购买：${item.purchasedQuantity}/${item.requiredQuantity} 件`
        : `全部购买：${item.purchasedQuantity} 件`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="shrink-0" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <ManagedImage
          src={item.productImageUrl}
          alt={item.productTitle}
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-5">
            {item.productTitle}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{statusText}</p>
          {item.deadline ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              截止时间 {formatDeadline(item.deadline)}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="touch"
        className="self-end text-primary"
        disabled={disabled}
        onClick={onRevoke}
      >
        {saving ? "撤销中" : "撤销结果"}
      </Button>
    </div>
  );
}
