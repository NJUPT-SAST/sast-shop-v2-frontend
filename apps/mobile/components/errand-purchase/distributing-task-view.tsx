"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowDownSLine, RiEditLine, RiForbidLine } from "@remixicon/react";
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
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
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
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";

import { ManagedImage } from "@/components/managed-image";
import { MobileFixedFooter } from "@/components/mobile-fixed-footer";
import { MobileHeaderActions } from "@/components/mobile-header-actions";
import { useTransactionAgreement } from "@/components/transaction-agreement-provider";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";
import { buildErrandTaskPaymentHref } from "@/lib/errand-task-route";
import {
  compareUpdatedAt,
  latestUpdatedAt,
  mergeDistributingTaskItems,
} from "@/lib/errand-recovery";
import {
  getDistributionQuantityAvailable,
  isDistributionItemComplete,
  isDistributionTaskComplete,
} from "@/lib/distribution-progress";

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
      maxQuantity: number;
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

export function DistributingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
  mode,
}: DistributingTaskViewProps) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const submittingRef = useRef(false);
  const assigningRef = useRef(false);
  const [items, setItems] = useState<DistributingTaskItem[]>(detail.items);
  const [taskUpdatedAt, setTaskUpdatedAt] = useState(detail.taskUpdatedAt);
  useEffect(() => {
    if (compareUpdatedAt(detail.taskUpdatedAt, taskUpdatedAt) >= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems((current) =>
        mergeDistributingTaskItems(
          current,
          detail.items,
          compareUpdatedAt(detail.taskUpdatedAt, taskUpdatedAt) > 0,
        ),
      );
    }
  }, [detail.items, detail.taskUpdatedAt, taskUpdatedAt]);
  const [unverifiedTaskVersion, setUnverifiedTaskVersion] = useState<
    string | null | undefined
  >();
  const taskNeedsVerification =
    unverifiedTaskVersion !== undefined &&
    compareUpdatedAt(taskUpdatedAt, unverifiedTaskVersion) <= 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTaskUpdatedAt((current) =>
      latestUpdatedAt(current, detail.taskUpdatedAt),
    );
  }, [detail.taskUpdatedAt]);
  const [packagingFee, setPackagingFee] = useState(
    formatYuan(detail.packagingFeeCents),
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [submitting, setSubmitting] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());

  const serviceOptions = { dataSource, connectBaseUrl };

  const purchasedItems = items.filter(
    (i) => i.purchasedQuantity != null && i.purchasedQuantity > 0,
  );

  const allPricesSet = purchasedItems.every(
    (i) => i.actualUnitPriceCents != null,
  );

  const undistributed = items.filter((i) => !isDistributionItemComplete(i));
  const distributed = items.filter(isDistributionItemComplete);
  const allDistributed = isDistributionTaskComplete(items);

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
                  : {
                      ...r,
                      distributedQuantity:
                        distributedQuantity === -1 ? null : distributedQuantity,
                      assignmentUpdatedAt,
                    },
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
    setTaskUpdatedAt((current) =>
      latestUpdatedAt(current, refreshed.taskUpdatedAt),
    );
    if (compareUpdatedAt(refreshed.taskUpdatedAt, taskUpdatedAt) >= 0) {
      setItems((current) =>
        mergeDistributingTaskItems(
          current,
          refreshed.items,
          compareUpdatedAt(refreshed.taskUpdatedAt, taskUpdatedAt) > 0,
        ),
      );
    }
  };

  const handleSaveAssignment = async (
    item: DistributingTaskItem,
    requester: DistributingRequester,
    distributedQuantity: number,
  ) => {
    const key = requester.errandTaskAssignmentId;
    if (
      assigningRef.current ||
      submittingRef.current ||
      taskNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    assigningRef.current = true;
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请稍后再试",
      );
    } finally {
      assigningRef.current = false;
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
    if (
      assigningRef.current ||
      submittingRef.current ||
      taskNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    assigningRef.current = true;
    setAssigningIds((prev) => new Set(prev).add(key));
    try {
      const saved = await saveDistributingAssignment(
        {
          errandTaskItemId: item.errandTaskItemId,
          errandTaskAssignmentId: requester.errandTaskAssignmentId,
          distributedQuantity: -1,
          assignmentUpdatedAt: requester.assignmentUpdatedAt,
        },
        serviceOptions,
      );
      updateRequester(
        item.errandTaskItemId,
        requester.errandTaskAssignmentId,
        -1,
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "撤销失败，请稍后再试",
      );
    } finally {
      assigningRef.current = false;
      setAssigningIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleUpdatePrice = async () => {
    if (dialog.type !== "edit_price") return;
    if (
      submittingRef.current ||
      assigningRef.current ||
      taskNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    const cents = parseYuanToCents(dialog.draft);
    if (cents === null) {
      toast.error("请输入不超过两位小数且未超出上限的实际单价");
      return;
    }
    submittingRef.current = true;
    setSavingPrice(true);
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
      updateItemPrice(dialog.item.errandTaskItemId, cents);
      try {
        const refreshed = await getDistributingTaskDetail(
          detail.taskId,
          serviceOptions,
        );
        applyRefreshedDetail(refreshed);
      } catch {
        toast.warning("价格已保存，但状态刷新失败，请重新进入任务");
      }
      setDialog({ type: "none" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "修改价格失败，请稍后再试",
      );
    } finally {
      submittingRef.current = false;
      setSavingPrice(false);
    }
  };

  const handleStartDistributing = async () => {
    if (
      submittingRef.current ||
      assigningRef.current ||
      taskNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    const feeCents = parseYuanToCents(packagingFee);
    if (feeCents === null) {
      toast.error("请输入不超过两位小数且未超出上限的包装费");
      return;
    }
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) {
      return;
    }
    if (submittingRef.current || assigningRef.current) {
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "操作失败，请稍后再试",
      );
      setUnverifiedTaskVersion(taskUpdatedAt);
      setDialog({ type: "none" });
      setSubmitting(false);
      router.refresh();
    } finally {
      submittingRef.current = false;
    }
  };

  const handleFinishDistributing = async () => {
    if (
      submittingRef.current ||
      assigningRef.current ||
      taskNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) {
      return;
    }
    if (submittingRef.current || assigningRef.current) {
      return;
    }
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
    } catch (error) {
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
      setUnverifiedTaskVersion(taskUpdatedAt);
      setDialog({ type: "none" });
      router.refresh();
      toast.error(
        error instanceof Error ? error.message : "操作失败，请稍后再试",
      );
      setSubmitting(false);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (
      submittingRef.current ||
      assigningRef.current ||
      taskNeedsVerification
    ) {
      toast.info("正在处理，请稍候");
      return;
    }
    const attemptedVersion = taskUpdatedAt;
    if (!(await ensureAgreement(() => setDialog({ type: "none" })))) return;
    if (
      submittingRef.current ||
      assigningRef.current ||
      taskNeedsVerification
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await cancelTask(detail.taskId, attemptedVersion, serviceOptions);
      setDialog({ type: "none" });
      router.replace("/orders?type=errand&view=captain");
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

  /* eslint-disable react-hooks/refs -- These callbacks are invoked by clicks, never during render. */
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
              <Collapsible
                key={item.errandTaskItemId}
                open={isExpanded}
                onOpenChange={(open) =>
                  setExpandedItemId(open ? item.errandTaskItemId : null)
                }
                className="rounded-lg border bg-card overflow-hidden"
              >
                <div className="relative isolate flex items-center gap-3 p-3">
                  <CollapsibleTrigger
                    type="button"
                    className="absolute inset-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`${isExpanded ? "收起" : "展开"}${item.title}的需求`}
                    aria-controls={`distributing-item-${item.errandTaskItemId}`}
                  />
                  <ManagedImage
                    src={item.imageUrl}
                    alt={item.title}
                    className="pointer-events-none size-14 shrink-0 rounded-lg"
                  />
                  <div className="pointer-events-none min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-5">
                      {item.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <span>实购 {item.purchasedQuantity ?? 0} 件</span>
                      {mode === "pending_distributing" &&
                      (item.purchasedQuantity ?? 0) > 0 ? (
                        <span className="pointer-events-auto relative inline-flex">
                          <Button
                            type="button"
                            size="xs"
                            variant="plain"
                            className="min-h-11 px-1 tabular-nums has-data-[icon=inline-end]:pr-1"
                            aria-label={`修改${item.title}的单价`}
                            disabled={
                              submitting ||
                              savingPrice ||
                              assigningIds.size > 0 ||
                              taskNeedsVerification
                            }
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
                            {item.actualUnitPriceCents == null
                              ? "填写单价"
                              : `实际 ${formatPrice(item.actualUnitPriceCents)}/件`}
                            <RiEditLine data-icon="inline-end" />
                          </Button>
                        </span>
                      ) : item.actualUnitPriceCents == null ? (
                        <span className="text-muted-foreground">未定价</span>
                      ) : (
                        <span>
                          实际 {formatPrice(item.actualUnitPriceCents)}/件
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pointer-events-none flex min-w-11 shrink-0 items-center gap-2">
                    <div className="flex -space-x-2">
                      {item.requesters.slice(0, 3).map((r) => (
                        <Avatar
                          key={r.purchaserId}
                          className="size-6 border-2 border-card text-foreground"
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
                    <RiArrowDownSLine
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </div>
                </div>

                <CollapsibleContent
                  id={`distributing-item-${item.errandTaskItemId}`}
                >
                  <div className="border-t px-3">
                    {mode === "pending_distributing" &&
                      (item.purchasedQuantity == null ||
                      item.purchasedQuantity === 0 ? (
                        <div className="mb-3 mt-3">
                          <Badge variant="neutral">未采购</Badge>
                        </div>
                      ) : null)}
                    <div className="flex flex-col divide-y">
                      {item.requesters.map((requester) => (
                        <RequesterRow
                          key={requester.errandTaskAssignmentId}
                          requester={requester}
                          mode={mode}
                          availableQuantity={getDistributionQuantityAvailable(
                            item,
                            requester.errandTaskAssignmentId,
                          )}
                          disabled={
                            submitting ||
                            savingPrice ||
                            assigningIds.size > 0 ||
                            taskNeedsVerification
                          }
                          saving={assigningIds.has(
                            requester.errandTaskAssignmentId,
                          )}
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
                              maxQuantity: Math.min(
                                requester.quantity - 1,
                                getDistributionQuantityAvailable(
                                  item,
                                  requester.errandTaskAssignmentId,
                                ),
                              ),
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
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </section>
    );
  };
  /* eslint-enable react-hooks/refs */

  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
      <MobileHeaderActions>
        <Button
          type="button"
          variant="destructive-text"
          size="touch"
          disabled={
            submitting ||
            savingPrice ||
            assigningIds.size > 0 ||
            taskNeedsVerification
          }
          onClick={() => setDialog({ type: "confirm_cancel" })}
        >
          取消采购
        </Button>
      </MobileHeaderActions>
      <section className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-lg font-semibold leading-7">
          {detail.storeName}
        </h1>
        <Badge variant={getStatusBadgeVariant(mode)} className="shrink-0">
          {getStatusLabel(mode)}
        </Badge>
      </section>

      {taskNeedsVerification ? (
        <p
          role="status"
          className="rounded-lg border px-3 py-2 text-sm text-muted-foreground"
        >
          任务状态待核实，请重新进入任务查看最新结果后再操作。
        </p>
      ) : null}

      {mode === "pending_distributing" && (
        <section className="rounded-lg border bg-card p-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            包装费
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>¥</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                disabled={
                  submitting ||
                  savingPrice ||
                  assigningIds.size > 0 ||
                  taskNeedsVerification
                }
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
              由实际分到商品的买家均摊（不含团长），按分向上取整
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
            disabled={
              parseYuanToCents(packagingFee) === null ||
              !allPricesSet ||
              submitting ||
              savingPrice ||
              assigningIds.size > 0 ||
              taskNeedsVerification
            }
            className="h-12 w-full"
            onClick={() => setDialog({ type: "confirm_start" })}
          >
            确认开始分发
          </Button>
        ) : (
          <Button
            type="button"
            disabled={
              !allDistributed ||
              assigningIds.size > 0 ||
              submitting ||
              taskNeedsVerification
            }
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
          if (!open && !savingPrice) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>修改单价</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "edit_price" ? dialog.item.title : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="min-h-0 overflow-y-auto">
            {dialog.type === "edit_price" && (
              <Field>
                <FieldLabel
                  htmlFor="distribution-unit-price"
                  className="sr-only"
                >
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
                    disabled={savingPrice}
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
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingPrice}
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={
                dialog.type !== "edit_price" ||
                parseYuanToCents(dialog.draft) === null ||
                savingPrice
              }
              onClick={() => void handleUpdatePrice()}
            >
              {savingPrice ? "保存中" : "保存单价"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog.type === "partial_dist"}
        onOpenChange={(open) => {
          if (!open && assigningIds.size === 0) setDialog({ type: "none" });
        }}
      >
        <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-sm">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>部分分发</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {dialog.type === "partial_dist"
                ? `输入分发数量（1 ~ ${dialog.maxQuantity}）`
                : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="min-h-0 overflow-y-auto">
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
                  disabled={assigningIds.size > 0}
                  inputMode="numeric"
                  min={1}
                  max={dialog.maxQuantity}
                  value={dialog.draft}
                  onChange={(e) =>
                    setDialog({ ...dialog, draft: e.target.value })
                  }
                  placeholder="分发数量"
                />
              </Field>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={assigningIds.size > 0}
              onClick={() => setDialog({ type: "none" })}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={
                dialog.type !== "partial_dist" ||
                assigningIds.size > 0 ||
                !dialog.draft ||
                !Number.isInteger(Number(dialog.draft)) ||
                Number(dialog.draft) < 1 ||
                Number(dialog.draft) > dialog.maxQuantity
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
              {assigningIds.size > 0 ? "保存中" : "记录分发数量"}
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
  availableQuantity,
  disabled,
  saving,
  onDistributeAll,
  onDistributePartial,
  onSkip,
  onRevoke,
}: {
  requester: DistributingRequester;
  mode: "pending_distributing" | "distributing";
  availableQuantity: number;
  disabled: boolean;
  saving: boolean;
  onDistributeAll: () => void;
  onDistributePartial: () => void;
  onSkip: () => void;
  onRevoke: () => void;
}) {
  const checkboxId = useId();
  const isDone =
    requester.distributedQuantity !== null && requester.distributedQuantity > 0;
  const isSkipped = requester.distributedQuantity === 0;
  const recorded = requester.distributedQuantity !== null;
  const fullyDistributed = requester.distributedQuantity === requester.quantity;
  const canDistributeAll = availableQuantity >= requester.quantity;
  const canDistributePartial = availableQuantity > 0 && requester.quantity > 1;

  return (
    <div className="flex min-h-18 items-center gap-2 py-2">
      {mode === "distributing" ? (
        <FieldLabel
          htmlFor={checkboxId}
          className="relative size-11 shrink-0 cursor-pointer justify-center"
        >
          <Checkbox
            id={checkboxId}
            checked={
              recorded ? (fullyDistributed ? true : "indeterminate") : false
            }
            disabled={disabled || (!recorded && !canDistributeAll)}
            className={cn(saving && "invisible")}
            aria-label={`${requester.purchaserName}${recorded ? "撤销分发结果" : "全部分发"}`}
            onCheckedChange={() => {
              if (recorded) onRevoke();
              else onDistributeAll();
            }}
          />
          {saving ? (
            <span role="status" className="absolute text-primary">
              <Spinner className="size-4" aria-hidden="true" />
              <span className="sr-only">保存中，请稍候</span>
            </span>
          ) : null}
        </FieldLabel>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Avatar className="size-8 shrink-0">
          <AvatarImage
            src={requester.purchaserAvatarUrl}
            alt={requester.purchaserName}
          />
          <AvatarFallback className="text-xs">
            {Array.from(requester.purchaserName)[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {requester.purchaserName}
          </p>
          <p
            className={cn(
              "text-xs tabular-nums text-muted-foreground",
              isDone && "text-primary",
            )}
          >
            {isDone
              ? `已分发 ${requester.distributedQuantity}/${requester.quantity} 件`
              : isSkipped
                ? `不分发 · 需 ${requester.quantity} 件`
                : `需 ${requester.quantity} 件`}
          </p>
          {!isDone && !isSkipped && availableQuantity < requester.quantity ? (
            <p className="text-xs text-muted-foreground">
              {availableQuantity > 0
                ? `当前最多可分发 ${availableQuantity} 件`
                : "暂无可分发数量"}
            </p>
          ) : null}
        </div>
      </div>
      {mode === "distributing" && !recorded ? (
        <div className="flex shrink-0 items-center">
          {canDistributePartial ? (
            <Button
              type="button"
              size="icon-touch"
              variant="ghost"
              className="text-muted-foreground active:bg-muted"
              aria-label={`${requester.purchaserName}部分分发`}
              disabled={disabled}
              onClick={onDistributePartial}
            >
              <RiEditLine className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-touch"
            variant="ghost"
            className="text-muted-foreground active:bg-muted"
            aria-label={`${requester.purchaserName}不分发`}
            disabled={disabled}
            onClick={onSkip}
          >
            <RiForbidLine className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
