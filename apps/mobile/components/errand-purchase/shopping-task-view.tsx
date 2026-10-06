"use client";

import { waitForDrawerHistoryCleanup } from "@workspace/ui/lib/drawer-history";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiEditLine } from "@remixicon/react";
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
import { Card, CardContent } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { FieldLabel } from "@workspace/ui/components/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { toast } from "sonner";

import { ManagedImage } from "@/components/managed-image";
import { MobileFixedFooter } from "@/components/mobile-fixed-footer";
import { MobileHeaderActions } from "@/components/mobile-header-actions";
import { useTransactionAgreement } from "@/components/transaction-agreement-provider";
import { ShoppingTaskItemEditor } from "./shopping-task-item-editor";
import {
  compareUpdatedAt,
  latestUpdatedAt,
  mergeShoppingTaskItems,
} from "@/lib/errand-recovery";
import { getShoppingProductTotalCents } from "@/lib/shopping-task-summary";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";

export type ShoppingTaskViewProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  detail: ShoppingTaskDetail;
  taskUpdatedAt: string | null;
};

type DialogState =
  | { type: "none" }
  | { type: "edit"; item: ShoppingTaskItem }
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

export function ShoppingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
  taskUpdatedAt,
}: ShoppingTaskViewProps) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const submittingRef = useRef(false);
  const [items, setItems] = useState<ShoppingTaskItem[]>(detail.taskItems);
  const [taskVersion, setTaskVersion] = useState(
    latestUpdatedAt(taskUpdatedAt, detail.taskUpdatedAt),
  );
  const [unverifiedTaskVersion, setUnverifiedTaskVersion] = useState<
    string | null | undefined
  >();
  const [unverifiedItem, setUnverifiedItem] = useState<{
    id: string;
    updatedAt: string;
    taskItems: ShoppingTaskItem[];
  } | null>(null);
  const refreshedUnverifiedItem = unverifiedItem
    ? detail.taskItems.find((item) => item.id === unverifiedItem.id)
    : undefined;
  const currentUnverifiedItem = unverifiedItem
    ? items.find((item) => item.id === unverifiedItem.id)
    : undefined;
  const itemNeedsVerification =
    unverifiedItem !== null &&
    (unverifiedItem.taskItems === detail.taskItems ||
      !refreshedUnverifiedItem?.updatedAt ||
      !currentUnverifiedItem?.updatedAt ||
      compareUpdatedAt(
        refreshedUnverifiedItem.updatedAt,
        unverifiedItem.updatedAt,
      ) < 0 ||
      compareUpdatedAt(
        currentUnverifiedItem.updatedAt,
        refreshedUnverifiedItem.updatedAt,
      ) < 0);
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
  const [submitting, setSubmitting] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const serviceOptions = { dataSource, connectBaseUrl };

  const unprocessed = items.filter((i) => !isPurchased(i));
  const processed = items.filter((i) => isPurchased(i));
  const allDone = unprocessed.length === 0;

  const totalProductCents = getShoppingProductTotalCents(items);
  const actionsDisabled =
    pendingItemId !== null ||
    submitting ||
    taskNeedsVerification ||
    itemNeedsVerification;
  const updateItem = (updated: ShoppingTaskItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleSave = async (
    item: ShoppingTaskItem,
    purchasedQuantity: number,
    nonPurchaseReason?: string,
  ) => {
    if (
      submittingRef.current ||
      taskNeedsVerification ||
      itemNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    if (!item.updatedAt) {
      toast.error("商品状态待核实，请重新进入任务后再操作");
      return;
    }
    submittingRef.current = true;
    setPendingItemId(item.id);
    try {
      const result = await saveShoppingTaskItem(
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
        purchasedQuantity: purchasedQuantity === -1 ? null : purchasedQuantity,
        nonPurchaseReason:
          purchasedQuantity === 0 ? (nonPurchaseReason ?? null) : null,
        updatedAt: result.itemUpdatedAt,
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
      if (!result.itemUpdatedAt && dataSource !== "local") {
        toast.warning("结果已保存，但商品状态待核实，请重新进入任务");
      }
      setDialog({ type: "none" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请稍后再试",
      );
      setUnverifiedItem({
        id: item.id,
        updatedAt: item.updatedAt,
        taskItems: detail.taskItems,
      });
      setDialog({ type: "none" });
      router.refresh();
    } finally {
      submittingRef.current = false;
      setPendingItemId(null);
    }
  };

  const handleComplete = async () => {
    if (
      submittingRef.current ||
      taskNeedsVerification ||
      itemNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    const attemptedVersion = taskVersion;
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) return;
    if (
      submittingRef.current ||
      taskNeedsVerification ||
      itemNeedsVerification
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await transitionToPendingDistributing(
        detail.taskId,
        attemptedVersion,
        serviceOptions,
      );
      setDialog({ type: "none" });
      router.refresh();
    } catch {
      toast.error("操作失败，请稍后再试");
      setUnverifiedTaskVersion(attemptedVersion);
      setDialog({ type: "none" });
      setSubmitting(false);
      router.refresh();
    } finally {
      submittingRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (
      submittingRef.current ||
      taskNeedsVerification ||
      itemNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    const attemptedVersion = taskVersion;
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) return;
    if (
      submittingRef.current ||
      taskNeedsVerification ||
      itemNeedsVerification
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await cancelTask(detail.taskId, attemptedVersion, serviceOptions);
      setDialog({ type: "none" });
      await waitForDrawerHistoryCleanup();
      router.push("/group");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "取消失败，请稍后再试",
      );
      setUnverifiedTaskVersion(attemptedVersion);
      setDialog({ type: "none" });
      setSubmitting(false);
      router.refresh();
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
      <MobileHeaderActions>
        <Button
          type="button"
          variant="destructive-text"
          size="touch"
          disabled={actionsDisabled}
          onClick={() => setDialog({ type: "confirm_cancel" })}
        >
          取消采购
        </Button>
      </MobileHeaderActions>
      <section className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-lg font-semibold leading-7">
          {detail.storeName}
        </h1>
        <Badge variant={getStatusBadgeVariant("shopping")} className="shrink-0">
          {getStatusLabel("shopping")}
        </Badge>
      </section>

      {taskNeedsVerification || itemNeedsVerification ? (
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
                disabled={actionsDisabled || !item.updatedAt}
                saving={pendingItemId === item.id}
                onRecordedChange={() =>
                  void handleSave(item, item.requiredQuantity)
                }
                onEdit={() => setDialog({ type: "edit", item })}
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
              <ShoppingItemCard
                key={item.id}
                item={item}
                disabled={actionsDisabled || !item.updatedAt}
                saving={pendingItemId === item.id}
                onRecordedChange={() => void handleSave(item, -1)}
                onEdit={() => setDialog({ type: "edit", item })}
              />
            ))}
          </div>
        </section>
      )}

      <MobileFixedFooter>
        <Button
          type="button"
          disabled={!allDone || actionsDisabled}
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

      <ShoppingTaskItemEditor
        item={dialog.type === "edit" ? dialog.item : null}
        saving={pendingItemId !== null}
        disabled={actionsDisabled}
        onClose={() => setDialog({ type: "none" })}
        onSave={(item, quantity, reason) =>
          void handleSave(item, quantity, reason)
        }
      />

      <ResponsiveDialog
        open={dialog.type === "confirm_complete"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-0 md:pb-4 sm:mx-auto sm:max-w-sm">
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
              disabled={actionsDisabled}
              onClick={() => setDialog({ type: "none" })}
            >
              返回
            </Button>
            <Button
              type="button"
              disabled={actionsDisabled}
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
        <ResponsiveDialogContent className="px-4 pb-0 md:pb-4 sm:mx-auto sm:max-w-sm">
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
  disabled,
  saving,
  onRecordedChange,
  onEdit,
}: {
  item: ShoppingTaskItem;
  disabled: boolean;
  saving: boolean;
  onRecordedChange: () => void;
  onEdit: () => void;
}) {
  const checkboxId = useId();
  const recorded = isPurchased(item);
  const resultText =
    item.purchasedQuantity === 0
      ? `不购买${item.nonPurchaseReason ? `：${item.nonPurchaseReason}` : ""}`
      : recorded
        ? `${item.purchasedQuantity === item.requiredQuantity ? "全部购买" : "部分购买"}：${item.purchasedQuantity}/${item.requiredQuantity} 件`
        : `需 ${item.requiredQuantity} 件`;

  return (
    <Item variant="outline" className="gap-1 p-2">
      <FieldLabel
        htmlFor={checkboxId}
        className="size-11 shrink-0 cursor-pointer justify-center"
      >
        <Checkbox
          id={checkboxId}
          checked={recorded}
          disabled={disabled}
          aria-label={
            recorded
              ? `将${item.productTitle}恢复为待采购`
              : `将${item.productTitle}记为全部购买`
          }
          onCheckedChange={onRecordedChange}
        />
      </FieldLabel>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        disabled={disabled}
        aria-label={`${recorded ? "修改" : "记录"}${item.productTitle}的采购结果`}
        onClick={onEdit}
      >
        <ManagedImage
          src={item.productImageUrl}
          alt=""
          className="size-12 shrink-0 rounded-lg"
        />
        <ItemContent>
          <ItemTitle className="line-clamp-2 leading-5">
            {item.productTitle}
          </ItemTitle>
          {!recorded && item.productDescription ? (
            <ItemDescription className="line-clamp-1 text-xs">
              {item.productDescription}
            </ItemDescription>
          ) : null}
          <ItemDescription className="text-xs">{resultText}</ItemDescription>
          {item.deadline ? (
            <ItemDescription className="text-xs">
              截止时间 {formatDeadline(item.deadline)}
            </ItemDescription>
          ) : null}
          {saving ? <span role="status">保存中，请稍候</span> : null}
        </ItemContent>
        <RiEditLine
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </Item>
  );
}
