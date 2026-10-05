"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiArrowLeftLine, RiCheckboxCircleLine } from "@remixicon/react";
import {
  cancelTask,
  getShoppingTaskDetail,
  saveShoppingTaskItem,
  transitionToPendingDistributing,
  type DataSource,
  type ShoppingTaskDetail,
  type ShoppingTaskItem,
} from "@sast-shop/api";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { toast } from "sonner";

import { ManagedImage } from "@/components/managed-image";
import {
  compareUpdatedAt,
  latestUpdatedAt,
  mergeShoppingTaskItems,
} from "@/lib/errand-recovery";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { useTransactionAgreement } from "../transaction-agreement-provider";

type DialogState =
  | { type: "none" }
  | { type: "edit"; item: ShoppingTaskItem }
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
  const { ensureAgreement } = useTransactionAgreement();
  const pendingRef = useRef(false);
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
    requireNewVersion: boolean;
  } | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [pending, setPending] = useState(false);
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
      ) < (unverifiedItem.requireNewVersion ? 1 : 0) ||
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
  const serviceOptions = { dataSource, connectBaseUrl };
  const processedCount = items.filter(
    (item) => item.purchasedQuantity !== null,
  ).length;
  const pendingItems = items.filter((item) => item.purchasedQuantity === null);
  const processedItems = items.filter(
    (item) => item.purchasedQuantity !== null,
  );
  const purchasedItems = processedItems.filter(
    (item) => (item.purchasedQuantity ?? 0) > 0,
  );
  const purchasedQuantity = purchasedItems.reduce(
    (total, item) => total + (item.purchasedQuantity ?? 0),
    0,
  );
  const allProcessed = processedCount === items.length && items.length > 0;
  const actionsDisabled =
    pending || taskNeedsVerification || itemNeedsVerification;

  async function saveItem(
    item: ShoppingTaskItem,
    purchasedQuantity: number,
    nonPurchaseReason?: string,
  ) {
    if (pendingRef.current || taskNeedsVerification || itemNeedsVerification)
      return;
    if (!item.updatedAt) {
      toast.error("商品状态待核实，请重新进入任务后再操作");
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      const result = await saveShoppingTaskItem(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.id,
          purchasedQuantity,
          nonPurchaseReason:
            purchasedQuantity === 0 ? nonPurchaseReason?.trim() || null : null,
          itemUpdatedAt: item.updatedAt,
        },
        serviceOptions,
      );
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                purchasedQuantity:
                  purchasedQuantity === -1 ? null : purchasedQuantity,
                nonPurchaseReason:
                  purchasedQuantity === 0
                    ? nonPurchaseReason?.trim() || null
                    : null,
                updatedAt: result.itemUpdatedAt,
              }
            : candidate,
        ),
      );
      try {
        const refreshed = await getShoppingTaskDetail(
          detail.taskId,
          serviceOptions,
        );
        const refreshedItem = refreshed.taskItems.find(
          (candidate) => candidate.id === item.id,
        );
        const expectedVersion = result.itemUpdatedAt ?? item.updatedAt;
        const versionDifference = compareUpdatedAt(
          refreshedItem?.updatedAt,
          expectedVersion,
        );
        if (
          compareUpdatedAt(refreshed.taskUpdatedAt, taskVersion) < 0 ||
          versionDifference < (result.itemUpdatedAt ? 0 : 1)
        ) {
          throw new Error("采购结果版本未更新");
        }
        setItems((current) =>
          mergeShoppingTaskItems(
            current,
            refreshed.taskItems,
            compareUpdatedAt(refreshed.taskUpdatedAt, taskVersion) > 0,
          ),
        );
        setTaskVersion((current) =>
          latestUpdatedAt(current, refreshed.taskUpdatedAt),
        );
      } catch {
        toast.warning("结果已保存，但状态刷新失败，请重新进入任务");
        setUnverifiedItem({
          id: item.id,
          updatedAt: result.itemUpdatedAt ?? item.updatedAt,
          taskItems: detail.taskItems,
          requireNewVersion: !result.itemUpdatedAt,
        });
        router.refresh();
      }
      setDialog({ type: "none" });
      toast.success(
        purchasedQuantity === -1 ? "已撤销采购结果" : "采购结果已保存",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请稍后再试",
      );
      setUnverifiedItem({
        id: item.id,
        updatedAt: item.updatedAt,
        taskItems: detail.taskItems,
        requireNewVersion: false,
      });
      setDialog({ type: "none" });
      router.refresh();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function completeShopping() {
    if (!allProcessed || pendingRef.current || actionsDisabled) return;
    const attemptedVersion = taskVersion;
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) return;
    if (pendingRef.current || taskNeedsVerification || itemNeedsVerification)
      return;
    pendingRef.current = true;
    setPending(true);
    try {
      await transitionToPendingDistributing(
        detail.taskId,
        attemptedVersion,
        serviceOptions,
      );
      setDialog({ type: "none" });
      setUnverifiedTaskVersion(attemptedVersion);
      toast.success("采购阶段已完成");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "状态更新失败，请刷新任务后重试",
      );
      setUnverifiedTaskVersion(attemptedVersion);
      setDialog({ type: "none" });
      router.refresh();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function cancelShopping() {
    if (pendingRef.current || actionsDisabled) return;
    const attemptedVersion = taskVersion;
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) return;
    if (pendingRef.current || taskNeedsVerification || itemNeedsVerification)
      return;
    pendingRef.current = true;
    setPending(true);
    try {
      await cancelTask(detail.taskId, attemptedVersion, serviceOptions);
      toast.success("采购任务已取消，需求已回到待接单");
      router.push("/orders?type=errand&view=captain");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "取消失败，请刷新任务后重试",
      );
      setUnverifiedTaskVersion(attemptedVersion);
      setDialog({ type: "none" });
      router.refresh();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function renderItemGroup(
    title: string,
    description: string,
    groupItems: ShoppingTaskItem[],
  ) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="neutral">{groupItems.length} 种</Badge>
        </div>
        {groupItems.length ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {groupItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                disabled={actionsDisabled}
                onToggle={() =>
                  void saveItem(
                    item,
                    item.purchasedQuantity === null
                      ? item.requiredQuantity
                      : -1,
                  )
                }
                onEdit={() => setDialog({ type: "edit", item })}
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
            <Badge variant={getStatusBadgeVariant("shopping")}>
              {getStatusLabel("shopping")}
            </Badge>
          </div>
        </div>
        <Button
          variant="destructive-text"
          size="touch"
          disabled={actionsDisabled}
          onClick={() => setDialog({ type: "cancel" })}
        >
          取消采购任务
        </Button>
      </section>

      {taskNeedsVerification || itemNeedsVerification ? (
        <p
          role="status"
          className="rounded-lg border px-4 py-3 text-sm text-muted-foreground"
        >
          任务状态待核实，请重新进入任务查看最新结果后再操作。
        </p>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm text-muted-foreground">处理进度</p>
            <p className="mt-1 text-lg font-semibold">
              {processedCount} 种已记录 · 共 {items.length} 种
            </p>
          </div>
          <Button
            disabled={!allProcessed || actionsDisabled}
            onClick={() => setDialog({ type: "complete" })}
          >
            <RiCheckboxCircleLine data-icon="inline-start" />
            完成采购阶段
          </Button>
        </CardContent>
      </Card>

      {renderItemGroup(
        "待处理",
        "勾选即按需求量全部购买，也可点击商品记录其他数量。",
        pendingItems,
      )}
      {renderItemGroup(
        "已处理",
        "点击商品可直接修改实购数量。",
        processedItems,
      )}

      <Dialog
        open={dialog.type === "edit"}
        onOpenChange={(open) =>
          !open && !pending && setDialog({ type: "none" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录采购</DialogTitle>
            <DialogDescription>
              {dialog.type === "edit"
                ? `${dialog.item.productTitle} · 需求 ${dialog.item.requiredQuantity} 件`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {dialog.type === "edit" ? (
            <PurchaseQuantityForm
              key={`${dialog.item.id}-${dialog.item.updatedAt}`}
              item={dialog.item}
              saving={pending}
              disabled={actionsDisabled}
              onClose={() => setDialog({ type: "none" })}
              onSave={saveItem}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={dialog.type === "complete"}
        title="完成采购"
        description={`已记录 ${processedCount} 种，实际采购 ${purchasedItems.length} 种、${purchasedQuantity} 件。完成后进入实际价格与分发设置。`}
        confirmLabel="完成采购"
        pending={pending}
        onCancel={() => setDialog({ type: "none" })}
        onConfirm={completeShopping}
      />
      <ConfirmationDialog
        open={dialog.type === "cancel"}
        title="取消采购任务"
        description="取消后该任务不会继续分发和收款，相关需求会回到待接单状态。"
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
  onToggle,
  onEdit,
}: {
  item: ShoppingTaskItem;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const checkboxId = useId();
  const recorded = item.purchasedQuantity !== null;
  const status = !recorded
    ? "待处理"
    : item.purchasedQuantity === 0
      ? "未购买"
      : item.purchasedQuantity === item.requiredQuantity
        ? "全部购买"
        : "部分购买";

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center gap-3">
        <FieldLabel htmlFor={checkboxId} className="shrink-0 cursor-pointer">
          <Checkbox
            id={checkboxId}
            checked={recorded}
            disabled={disabled}
            onCheckedChange={onToggle}
            aria-label={`将${item.productTitle}${recorded ? "恢复为待采购" : "记为全部购买"}`}
          />
        </FieldLabel>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${recorded ? "修改" : "记录"}${item.productTitle}的采购结果`}
          disabled={disabled}
          onClick={onEdit}
        >
          <ManagedImage
            src={item.productImageUrl}
            alt={item.productTitle}
            className="size-16 shrink-0 rounded-lg border"
          />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-base font-semibold">
                {item.productTitle}
              </span>
              <Badge
                variant={
                  recorded
                    ? item.purchasedQuantity === 0
                      ? "danger"
                      : "success"
                    : "neutral"
                }
                className="shrink-0"
              >
                {status}
              </Badge>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {recorded
                ? `实购 ${item.purchasedQuantity}/${item.requiredQuantity} 件`
                : `需求 ${item.requiredQuantity} 件`}
            </span>
            {item.deadline ? (
              <span className="block text-xs text-muted-foreground">
                截止 {formatDeadline(item.deadline)}
              </span>
            ) : null}
            {item.nonPurchaseReason ? (
              <span className="block text-sm text-destructive">
                原因：{item.nonPurchaseReason}
              </span>
            ) : null}
          </span>
        </button>
      </CardHeader>
    </Card>
  );
}

function PurchaseQuantityForm({
  item,
  saving,
  disabled,
  onClose,
  onSave,
}: {
  item: ShoppingTaskItem;
  saving: boolean;
  disabled: boolean;
  onClose: () => void;
  onSave: (item: ShoppingTaskItem, quantity: number, reason?: string) => void;
}) {
  const [quantity, setQuantity] = useState(
    String(item.purchasedQuantity ?? item.requiredQuantity),
  );
  const [reason, setReason] = useState(item.nonPurchaseReason ?? "");
  const parsed = Number(quantity);
  const valid =
    /^\d+$/.test(quantity.trim()) &&
    Number.isSafeInteger(parsed) &&
    parsed >= 0 &&
    parsed <= item.requiredQuantity;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || !valid || !item.updatedAt) return;
    onSave(item, parsed, parsed === 0 ? reason.trim() : undefined);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field data-invalid={!valid}>
        <FieldLabel htmlFor="purchase-quantity">实购数量</FieldLabel>
        <Input
          id="purchase-quantity"
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-invalid={!valid}
          disabled={disabled}
        />
        {valid ? (
          <FieldDescription>填 0 表示不购买</FieldDescription>
        ) : (
          <FieldError>请输入0至{item.requiredQuantity}之间的整数</FieldError>
        )}
      </Field>
      {valid && parsed === 0 ? (
        <Field>
          <FieldLabel htmlFor="purchase-reason">不购买原因（可选）</FieldLabel>
          <Textarea
            id="purchase-reason"
            maxLength={15}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 15))}
            disabled={disabled}
          />
        </Field>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onClose}
        >
          取消
        </Button>
        <Button type="submit" disabled={disabled || !valid || !item.updatedAt}>
          {saving ? "保存中" : "保存采购结果"}
        </Button>
      </DialogFooter>
    </form>
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
