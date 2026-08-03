"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowGoBackLine,
  RiArrowLeftDoubleLine,
  RiArrowRightDoubleLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCheckboxLine,
  RiCloseCircleLine,
  RiIndeterminateCircleLine,
} from "@remixicon/react";
import {
  cancelTask,
  getDistributingTaskDetail,
  getErrandTaskBrief,
  saveDistributingAssignment,
  transitionToCollectingPayment,
  transitionToDistributing,
  updateActualPrice,
  type DataSource,
  type DistributingRequester,
  type DistributingTaskDetail,
  type DistributingTaskItem,
} from "@sast-shop/api";
import { formatPrice, parseYuanToCents } from "@sast-shop/domain";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
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
import { buildErrandTaskPaymentHref } from "@/lib/errand-task-route";

export type DistributingTaskViewProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  detail: DistributingTaskDetail;
  mode: "pending_distributing" | "distributing";
};

type DialogState =
  | { type: "none" }
  | { type: "edit_price"; item: DistributingTaskItem; draft: string }
  | {
      type: "partial_dist";
      item: DistributingTaskItem;
      requester: DistributingRequester;
      draft: string;
    }
  | { type: "confirm_start" }
  | { type: "confirm_finish" }
  | { type: "confirm_cancel" };

const MONEY_PATTERN = /^\d*(?:\.\d{0,2})?$/;

function formatYuan(cents: number): string {
  if (cents === 0) return "0";
  return (cents / 100).toFixed(2);
}

function isItemFullyDistributed(item: DistributingTaskItem): boolean {
  if (item.purchasedQuantity == null || item.purchasedQuantity === 0) {
    return true; // 未采购，无需分发
  }
  const totalDistributed = item.requesters.reduce(
    (s, r) => s + Math.max(0, r.distributedQuantity),
    0,
  );
  return totalDistributed >= item.purchasedQuantity;
}

export function DistributingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
  mode,
}: DistributingTaskViewProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [items, setItems] = useState<DistributingTaskItem[]>(detail.items);
  const [taskUpdatedAt, setTaskUpdatedAt] = useState(detail.taskUpdatedAt);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTaskUpdatedAt((current) => detail.taskUpdatedAt ?? current);
  }, [detail.taskUpdatedAt]);
  const [packagingFee, setPackagingFee] = useState(
    formatYuan(detail.packagingFeeCents),
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [submitting, setSubmitting] = useState(false);
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());

  const serviceOptions = { dataSource, connectBaseUrl };

  const purchasedItems = items.filter(
    (i) => i.purchasedQuantity != null && i.purchasedQuantity > 0,
  );

  const undistributed = purchasedItems.filter(
    (i) => !isItemFullyDistributed(i),
  );
  const distributed = purchasedItems.filter((i) => isItemFullyDistributed(i));
  const allDistributed =
    items.length > 0 &&
    items.every((item) => {
      if (item.purchasedQuantity == null || item.purchasedQuantity === 0) {
        return true; // 未采购，无需分发
      }
      const totalDistributed = item.requesters.reduce(
        (s, r) => s + Math.max(0, r.distributedQuantity),
        0,
      );
      return totalDistributed >= item.purchasedQuantity;
    });

  const updateRequester = (
    itemId: string,
    assignmentId: string,
    distributedQuantity: number,
    assignmentUpdatedAt: string | null,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.errandTaskItemId !== itemId
          ? item
          : {
              ...item,
              requesters: item.requesters.map((r) =>
                r.errandTaskAssignmentId !== assignmentId
                  ? r
                  : { ...r, distributedQuantity, assignmentUpdatedAt },
              ),
            },
      ),
    );
  };

  const updateItemPrice = (itemId: string, actualUnitPriceCents: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.errandTaskItemId !== itemId
          ? item
          : { ...item, actualUnitPriceCents },
      ),
    );
  };

  const applyRefreshedDetail = (refreshed: DistributingTaskDetail) => {
    setTaskUpdatedAt((current) => refreshed.taskUpdatedAt ?? current);
    setItems((current) => {
      const currentItemUpdatedAtById = new Map(
        current.map((item) => [item.errandTaskItemId, item.itemUpdatedAt]),
      );

      return refreshed.items.map((item) => ({
        ...item,
        itemUpdatedAt:
          item.itemUpdatedAt ??
          currentItemUpdatedAtById.get(item.errandTaskItemId) ??
          null,
      }));
    });
  };

  const handleSaveAssignment = async (
    item: DistributingTaskItem,
    requester: DistributingRequester,
    distributedQuantity: number,
  ) => {
    const key = requester.errandTaskAssignmentId;
    if (assigningIds.has(key)) return;
    setAssigningIds((prev) => new Set(prev).add(key));
    try {
      const saved = await saveDistributingAssignment(
        {
          errandTaskItemId: item.errandTaskItemId,
          errandTaskAssignmentId: requester.errandTaskAssignmentId,
          distributedQuantity,
          assignmentUpdatedAt: requester.assignmentUpdatedAt,
        },
        serviceOptions,
      );
      updateRequester(
        item.errandTaskItemId,
        requester.errandTaskAssignmentId,
        distributedQuantity,
        saved.assignmentUpdatedAt ?? requester.assignmentUpdatedAt,
      );
      if (dataSource === "local") {
        try {
          const refreshed = await getDistributingTaskDetail(
            detail.taskId,
            serviceOptions,
          );
          applyRefreshedDetail(refreshed);
        } catch {
          toast.warning("结果已保存，但状态刷新失败，请重新进入任务");
        }
      }
      setDialog({ type: "none" });
    } catch {
      toast.error("保存失败，请稍后再试");
    } finally {
      setAssigningIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRevokeAssignment = async (
    item: DistributingTaskItem,
    requester: DistributingRequester,
  ) => {
    const key = requester.errandTaskAssignmentId;
    if (assigningIds.has(key)) return;
    setAssigningIds((prev) => new Set(prev).add(key));
    try {
      const saved = await saveDistributingAssignment(
        {
          errandTaskItemId: item.errandTaskItemId,
          errandTaskAssignmentId: requester.errandTaskAssignmentId,
          distributedQuantity: 0,
          assignmentUpdatedAt: requester.assignmentUpdatedAt,
        },
        serviceOptions,
      );
      updateRequester(
        item.errandTaskItemId,
        requester.errandTaskAssignmentId,
        0,
        saved.assignmentUpdatedAt ?? requester.assignmentUpdatedAt,
      );
      if (dataSource === "local") {
        try {
          const refreshed = await getDistributingTaskDetail(
            detail.taskId,
            serviceOptions,
          );
          applyRefreshedDetail(refreshed);
        } catch {
          toast.warning("结果已撤销，但状态刷新失败，请重新进入任务");
        }
      }
    } catch {
      toast.error("撤销失败，请稍后再试");
    } finally {
      setAssigningIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleUpdatePrice = async () => {
    if (dialog.type !== "edit_price") return;
    if (submittingRef.current) return;
    const cents = parseYuanToCents(dialog.draft);
    if (cents === null) {
      toast.error("请输入不超过两位小数且未超出上限的实际单价");
      return;
    }
    submittingRef.current = true;
    try {
      await updateActualPrice(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: dialog.item.errandTaskItemId,
          actualUnitPriceCents: cents,
          itemUpdatedAt: dialog.item.itemUpdatedAt,
        },
        serviceOptions,
      );
      try {
        const refreshed = await getDistributingTaskDetail(
          detail.taskId,
          serviceOptions,
        );
        applyRefreshedDetail(refreshed);
      } catch {
        updateItemPrice(dialog.item.errandTaskItemId, cents);
        toast.warning("价格已保存，但状态刷新失败，请重新进入任务");
      }
      setDialog({ type: "none" });
    } catch {
      toast.error("修改价格失败，请稍后再试");
    } finally {
      submittingRef.current = false;
    }
  };

  const handleStartDistributing = async () => {
    if (submittingRef.current) return;
    const feeCents = parseYuanToCents(packagingFee);
    if (feeCents === null) {
      toast.error("请输入不超过两位小数且未超出上限的包装费");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await transitionToDistributing(
        detail.taskId,
        feeCents,
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

  const handleFinishDistributing = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await transitionToCollectingPayment(
        detail.taskId,
        taskUpdatedAt,
        serviceOptions,
      );
      setDialog({ type: "none" });
      router.replace(buildErrandTaskPaymentHref(detail.taskId));
    } catch {
      try {
        const task = await getErrandTaskBrief(detail.taskId, serviceOptions);
        if (task?.status === "collecting_payment") {
          toast.error("账单生成异常，请刷新或联系处理");
          router.replace(
            `${buildErrandTaskPaymentHref(detail.taskId)}?notice=billing_generation_failed`,
          );
          return;
        }
      } catch {
        // Keep the original transition error as the user-facing result.
      }
      router.refresh();
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
      router.replace("/orders?type=errand&view=captain");
    } catch {
      toast.error("取消失败，请稍后再试");
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  const renderItemList = (list: DistributingTaskItem[], groupLabel: string) => {
    if (list.length === 0) return null;
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">{groupLabel}</h2>
          <span className="text-xs text-muted-foreground">
            {list.length} 种商品
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {list.map((item) => {
            const isExpanded = expandedItemId === item.errandTaskItemId;
            return (
              <div
                key={item.errandTaskItemId}
                className="rounded-lg border bg-card overflow-hidden"
              >
                <button
                  type="button"
                  aria-controls={`distributing-item-${item.errandTaskItemId}`}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setExpandedItemId(isExpanded ? null : item.errandTaskItemId)
                  }
                >
                  <ManagedImage
                    src={item.imageUrl}
                    alt={item.title}
                    className="size-14 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-5">
                      {item.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <span>
                        实购 {item.purchasedQuantity ?? 0} 件
                      </span>
                      <span aria-hidden="true">·</span>
                      {item.actualUnitPriceCents == null ? (
                        <span className="text-muted-foreground">未定价</span>
                      ) : item.actualUnitPriceCents !==
                        item.originUnitPriceCents ? (
                        <span className="text-destructive">
                          改价后 {formatPrice(item.actualUnitPriceCents)}/件
                        </span>
                      ) : (
                        <span>{formatPrice(item.actualUnitPriceCents)}/件</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex -space-x-2">
                      {item.requesters.slice(0, 3).map((r) => (
                        <Avatar
                          key={r.purchaserId}
                          className="size-6 border-2 border-card"
                        >
                          <AvatarImage
                            src={r.purchaserAvatarUrl}
                            alt={r.purchaserName}
                          />
                          <AvatarFallback className="text-xs">
                            {r.purchaserName[0]}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {isExpanded ? (
                      <RiArrowUpSLine className="size-4 text-muted-foreground" />
                    ) : (
                      <RiArrowDownSLine className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div
                    id={`distributing-item-${item.errandTaskItemId}`}
                    className="border-t px-3 pb-3"
                  >
                    {mode === "pending_distributing" &&
                      (item.purchasedQuantity == null ||
                      item.purchasedQuantity === 0 ? (
                        <div className="mb-3 mt-3">
                          <Badge variant="neutral">未采购</Badge>
                        </div>
                      ) : (
                        <div className="mb-3 mt-3 flex items-center justify-between gap-3">
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {item.actualUnitPriceCents != null
                              ? `单价 ${formatPrice(item.actualUnitPriceCents)}/件`
                              : "未定价"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDialog({
                                type: "edit_price",
                                item,
                                draft:
                                  item.actualUnitPriceCents != null
                                    ? formatYuan(item.actualUnitPriceCents)
                                    : "",
                              })
                            }
                          >
                            改价
                          </Button>
                        </div>
                      ))}
                    <div className="mt-3 flex flex-col gap-3">
                      {item.requesters.map((requester) => (
                        <RequesterRow
                          key={requester.errandTaskAssignmentId}
                          requester={requester}
                          mode={mode}
                          onDistributeAll={() =>
                            void handleSaveAssignment(
                              item,
                              requester,
                              requester.quantity,
                            )
                          }
                          onDistributePartial={() =>
                            setDialog({
                              type: "partial_dist",
                              item,
                              requester,
                              draft: "",
                            })
                          }
                          onSkip={() =>
                            void handleSaveAssignment(item, requester, 0)
                          }
                          onRevoke={() =>
                            void handleRevokeAssignment(item, requester)
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-5 pb-24">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-7">
            {detail.storeName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "pending_distributing" ? "待分发" : "分发中"}
          </p>
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

      {mode === "pending_distributing" && (
        <section className="rounded-lg border bg-card p-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            包装费
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>¥</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                inputMode="decimal"
                value={packagingFee}
                onChange={(e) => {
                  if (MONEY_PATTERN.test(e.target.value)) {
                    setPackagingFee(e.target.value);
                  }
                }}
                placeholder="0"
              />
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              将按购买金额比例分摊到每位买家，除不尽时向上取整
            </p>
            {parseYuanToCents(packagingFee) === null ? (
              <p className="text-xs text-destructive">
                请输入不超过两位小数且未超出金额上限的包装费
              </p>
            ) : null}
          </label>
        </section>
      )}

      {mode === "distributing" && renderItemList(undistributed, "待分发")}
      {mode === "distributing" && renderItemList(distributed, "已分发")}
      {mode === "pending_distributing" &&
        renderItemList(purchasedItems, "采购商品")}

      <MobileFixedFooter>
        {mode === "pending_distributing" ? (
          <Button
            type="button"
            disabled={parseYuanToCents(packagingFee) === null}
            className="h-12 w-full"
            onClick={() => setDialog({ type: "confirm_start" })}
          >
            确认开始分发
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!allDistributed || assigningIds.size > 0}
            className="h-12 w-full"
            onClick={() => setDialog({ type: "confirm_finish" })}
          >
            {allDistributed
              ? "确认分发完成"
              : `还有 ${undistributed.length} 种商品待分发`}
          </Button>
        )}
      </MobileFixedFooter>

      <ResponsiveDialog
        open={dialog.type === "edit_price"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>修改单价</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "edit_price" ? dialog.item.title : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {dialog.type === "edit_price" && (
            <Field>
              <FieldLabel htmlFor="distribution-unit-price" className="sr-only">
                实际单价
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>¥</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="distribution-unit-price"
                  type="text"
                  inputMode="decimal"
                  value={dialog.draft}
                  onChange={(e) => {
                    if (MONEY_PATTERN.test(e.target.value)) {
                      setDialog({ ...dialog, draft: e.target.value });
                    }
                  }}
                  placeholder="0.00"
                />
              </InputGroup>
              {parseYuanToCents(dialog.draft) === null ? (
                <p className="text-xs text-destructive">
                  请输入不超过两位小数且未超出金额上限的单价
                </p>
              ) : null}
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
                dialog.type !== "edit_price" ||
                parseYuanToCents(dialog.draft) === null
              }
              onClick={() => void handleUpdatePrice()}
            >
              确认
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "partial_dist"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>部分分发</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "partial_dist"
                ? `输入分发数量（1 ~ ${dialog.requester.quantity - 1}）`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {dialog.type === "partial_dist" && (
            <Field>
              <FieldLabel
                htmlFor="partial-distribution-quantity"
                className="sr-only"
              >
                实际分发数量
              </FieldLabel>
              <Input
                id="partial-distribution-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={dialog.requester.quantity - 1}
                value={dialog.draft}
                onChange={(e) =>
                  setDialog({ ...dialog, draft: e.target.value })
                }
                placeholder="分发数量"
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
                dialog.type !== "partial_dist" ||
                !dialog.draft ||
                !Number.isInteger(Number(dialog.draft)) ||
                Number(dialog.draft) < 1 ||
                Number(dialog.draft) >= dialog.requester.quantity
              }
              onClick={() => {
                if (dialog.type !== "partial_dist") return;
                void handleSaveAssignment(
                  dialog.item,
                  dialog.requester,
                  Number(dialog.draft),
                );
              }}
            >
              确认
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "confirm_start"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认开始分发</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              开始分发后将无法修改商品单价，包装费为{" "}
              {formatPrice(parseYuanToCents(packagingFee) ?? 0)}。
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
              disabled={submitting}
              onClick={() => void handleStartDistributing()}
            >
              {submitting ? "处理中" : "确认开始"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "confirm_finish"}
        onOpenChange={(open) => {
          if (!open && !submitting) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认分发完成</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              确认所有商品已分发完毕，将进入收款阶段。
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
              disabled={submitting}
              onClick={() => void handleFinishDistributing()}
            >
              {submitting ? "处理中" : "确认完成"}
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

function RequesterRow({
  requester,
  mode,
  onDistributeAll,
  onDistributePartial,
  onSkip,
  onRevoke,
}: {
  requester: DistributingRequester;
  mode: "pending_distributing" | "distributing";
  onDistributeAll: () => void;
  onDistributePartial: () => void;
  onSkip: () => void;
  onRevoke: () => void;
}) {
  const isDone = requester.distributedQuantity > 0;
  const isSkipped = requester.distributedQuantity === 0;
  const [actionOpen, setActionOpen] = useState(false);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const canDistributePartially = requester.quantity > 1;
  const actionWidthClass =
    isDone || isSkipped
      ? "w-[52px] grid-cols-1"
      : canDistributePartially
        ? "w-[156px] grid-cols-3"
        : "w-[104px] grid-cols-2";

  const runAction = (action: () => void) => {
    setActionOpen(false);
    action();
  };

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
    setActionOpen(deltaX < 0);
  };

  return (
    <div
      className={
        mode === "distributing"
          ? "relative overflow-hidden rounded-lg border bg-card sm:overflow-visible sm:border-0 sm:bg-transparent"
          : ""
      }
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartXRef.current = null;
        pointerStartYRef.current = null;
      }}
    >
      {mode === "distributing" ? (
        <div
          className={`absolute inset-y-0 right-0 z-20 grid overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none sm:hidden ${actionWidthClass} ${actionOpen ? "translate-x-0" : "translate-x-full"}`}
          aria-hidden={!actionOpen}
        >
          {isDone || isSkipped ? (
            <Button
              type="button"
              variant="secondary"
              className="h-full min-w-0 rounded-none px-0"
              tabIndex={actionOpen ? 0 : -1}
              aria-label="撤销分发结果"
              title="撤销"
              onClick={() => runAction(onRevoke)}
            >
              <RiArrowGoBackLine className="size-6" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="h-full min-w-0 rounded-none px-0"
                tabIndex={actionOpen ? 0 : -1}
                aria-label="全部分发"
                title="全部分发"
                onClick={() => runAction(onDistributeAll)}
              >
                <RiCheckboxLine className="size-6" />
              </Button>
              {canDistributePartially ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-full min-w-0 rounded-none px-0"
                  tabIndex={actionOpen ? 0 : -1}
                  aria-label="部分分发"
                  title="部分分发"
                  onClick={() => runAction(onDistributePartial)}
                >
                  <RiIndeterminateCircleLine className="size-6" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                className="h-full min-w-0 rounded-none px-0"
                tabIndex={actionOpen ? 0 : -1}
                aria-label="不分发"
                title="不分发"
                onClick={() => runAction(onSkip)}
              >
                <RiCloseCircleLine className="size-6" />
              </Button>
            </>
          )}
        </div>
      ) : null}

      <div
        className={`flex items-center gap-2 ${
          mode === "distributing"
            ? "relative z-10 touch-pan-y rounded-lg bg-card p-2 sm:bg-transparent sm:p-0"
            : ""
        }`}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarImage
            src={requester.purchaserAvatarUrl}
            alt={requester.purchaserName}
          />
          <AvatarFallback className="text-xs">
            {requester.purchaserName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {requester.purchaserName}
          </p>
          <p className="text-xs text-muted-foreground">
            需 {requester.quantity} 件
            {isDone ? `，已分发 ${requester.distributedQuantity} 件` : ""}
            {isSkipped ? "，不分发" : ""}
          </p>
        </div>
        {mode === "distributing" ? (
          <>
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              {isDone || isSkipped ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={onRevoke}
                >
                  撤销
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={onSkip}
                  >
                    不分发
                  </Button>
                  {requester.quantity > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={onDistributePartial}
                    >
                      部分
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    onClick={onDistributeAll}
                  >
                    全部
                  </Button>
                </>
              )}
            </div>
            <Button
              type="button"
              size="icon-touch"
              variant="ghost"
              className={`shrink-0 text-muted-foreground transition-opacity sm:hidden ${actionOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
              tabIndex={actionOpen ? -1 : 0}
              aria-label={`${actionOpen ? "收起" : "展开"}${requester.purchaserName}的分发操作`}
              aria-expanded={actionOpen}
              onClick={() => {
                if (swipedRef.current) {
                  swipedRef.current = false;
                  return;
                }
                setActionOpen((open) => !open);
              }}
            >
              {actionOpen ? (
                <RiArrowRightDoubleLine />
              ) : (
                <RiArrowLeftDoubleLine />
              )}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
