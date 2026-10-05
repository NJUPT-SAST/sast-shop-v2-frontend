"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiEditLine,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
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
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";

import { buildErrandTaskPaymentHref } from "@/lib/errand-task-route";
import {
  getDistributionQuantityAvailable,
  isDistributionItemComplete,
  isDistributionTaskComplete,
} from "@/lib/distribution-progress";
import {
  compareUpdatedAt,
  latestUpdatedAt,
  mergeDistributingTaskItems,
} from "@/lib/errand-recovery";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/order-filters";

import { ManagedImage } from "@/components/managed-image";
import { useTransactionAgreement } from "../transaction-agreement-provider";

type Confirmation = "start" | "finish" | "cancel" | null;
const moneyPattern = /^\d*(?:\.\d{0,2})?$/;

export function DistributingTaskView({
  dataSource,
  connectBaseUrl,
  detail,
  mode,
}: {
  dataSource: DataSource;
  connectBaseUrl?: string;
  detail: DistributingTaskDetail;
  mode: "pending_distributing" | "distributing";
}) {
  const router = useRouter();
  const { ensureAgreement } = useTransactionAgreement();
  const pendingRef = useRef(false);
  const [items, setItems] = useState<DistributingTaskItem[]>(detail.items);
  const itemsRef = useRef(detail.items);
  const [taskUpdatedAt, setTaskUpdatedAt] = useState(detail.taskUpdatedAt);
  const [unverifiedTaskVersion, setUnverifiedTaskVersion] = useState<
    string | null | undefined
  >();
  const [unverifiedMutation, setUnverifiedMutation] = useState<{
    kind: "price" | "assignment";
    id: string;
    updatedAt: string | null;
    items: DistributingTaskItem[];
    requireNewVersion: boolean;
  } | null>(null);
  const taskNeedsVerification =
    unverifiedTaskVersion !== undefined &&
    compareUpdatedAt(taskUpdatedAt, unverifiedTaskVersion) <= 0;
  const mutationNeedsVerification =
    unverifiedMutation !== null &&
    (detail.items === unverifiedMutation.items ||
      compareUpdatedAt(
        unverifiedMutation.kind === "price"
          ? detail.items.find(
              (item) => item.errandTaskItemId === unverifiedMutation.id,
            )?.itemUpdatedAt
          : detail.items
              .flatMap((item) => item.requesters)
              .find(
                (requester) =>
                  requester.errandTaskAssignmentId === unverifiedMutation.id,
              )?.assignmentUpdatedAt,
        unverifiedMutation.updatedAt,
      ) < (unverifiedMutation.requireNewVersion ? 1 : 0));
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      detail.items.map((item) => [
        item.errandTaskItemId,
        item.actualUnitPriceCents != null
          ? formatYuan(item.actualUnitPriceCents)
          : "",
      ]),
    ),
  );
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      detail.items.flatMap((item) =>
        item.requesters.map((requester) => [
          requester.errandTaskAssignmentId,
          requester.distributedQuantity != null
            ? String(requester.distributedQuantity)
            : "",
        ]),
      ),
    ),
  );
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
      setAssignmentDrafts((current) => {
        const next = { ...current };
        for (const incomingItem of detail.items) {
          const priorItem = itemsRef.current.find(
            (item) => item.errandTaskItemId === incomingItem.errandTaskItemId,
          );
          for (const requester of incomingItem.requesters) {
            const prior = priorItem?.requesters.find(
              (candidate) =>
                candidate.errandTaskAssignmentId ===
                requester.errandTaskAssignmentId,
            );
            if (
              compareUpdatedAt(
                requester.assignmentUpdatedAt,
                prior?.assignmentUpdatedAt,
              ) > 0
            ) {
              next[requester.errandTaskAssignmentId] =
                requester.distributedQuantity === null
                  ? ""
                  : String(requester.distributedQuantity);
            }
          }
        }
        return next;
      });
    }
    setTaskUpdatedAt((current) =>
      latestUpdatedAt(current, detail.taskUpdatedAt),
    );
  }, [detail.items, detail.taskUpdatedAt, taskUpdatedAt]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [packagingFee, setPackagingFee] = useState(
    formatYuan(detail.packagingFeeCents),
  );
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [priceItemId, setPriceItemId] = useState<string | null>(null);
  const priceItem = items.find((item) => item.errandTaskItemId === priceItemId);
  const actionsDisabled =
    pending ||
    pendingKeys.size > 0 ||
    taskNeedsVerification ||
    mutationNeedsVerification;
  const serviceOptions = { dataSource, connectBaseUrl };
  const requesters = useMemo(
    () => items.flatMap((item) => item.requesters),
    [items],
  );
  const processedCount = requesters.filter(isRequesterProcessed).length;
  const allProcessed = isDistributionTaskComplete(items);
  const distributionGroups =
    mode === "pending_distributing"
      ? [
          {
            key: "pricing",
            title: "待核价",
            description: "核对每种商品的实际单价后开始分发。",
            items,
          },
        ]
      : [
          {
            key: "pending",
            title: "待分发",
            description: "仍有参与者尚未记录分发结果。",
            items: items.filter((item) => !isDistributionItemComplete(item)),
          },
          {
            key: "completed",
            title: "已分发",
            description: "所有参与者的分发结果均已记录。",
            items: items.filter(isDistributionItemComplete),
          },
        ];
  const allPricesSaved = items
    .filter((item) => (item.purchasedQuantity ?? 0) > 0)
    .every((item) => item.actualUnitPriceCents !== null);

  function updateRequesterAssignment(
    itemId: string,
    assignmentId: string,
    distributedQuantity: number,
    assignmentUpdatedAt: string | null,
  ) {
    const updated = itemsRef.current.map((item) =>
      item.errandTaskItemId !== itemId
        ? item
        : {
            ...item,
            requesters: item.requesters.map((requester) =>
              requester.errandTaskAssignmentId !== assignmentId
                ? requester
                : {
                    ...requester,
                    distributedQuantity:
                      distributedQuantity === -1 ? null : distributedQuantity,
                    assignmentUpdatedAt,
                  },
            ),
          },
    );
    itemsRef.current = updated;
    setItems(updated);
    setAssignmentDrafts((current) => ({
      ...current,
      [assignmentId]:
        distributedQuantity !== -1 ? String(distributedQuantity) : "",
    }));
  }

  function applyRefreshedDetail(refreshed: DistributingTaskDetail) {
    if (compareUpdatedAt(refreshed.taskUpdatedAt, taskUpdatedAt) < 0) return;
    const updated = mergeDistributingTaskItems(
      itemsRef.current,
      refreshed.items,
      compareUpdatedAt(refreshed.taskUpdatedAt, taskUpdatedAt) > 0,
    );
    itemsRef.current = updated;
    setItems(updated);
    setTaskUpdatedAt((current) =>
      latestUpdatedAt(current, refreshed.taskUpdatedAt),
    );
  }

  async function savePrice(item: DistributingTaskItem) {
    if (
      pendingRef.current ||
      taskNeedsVerification ||
      mutationNeedsVerification
    )
      return;
    const currentItem = itemsRef.current.find(
      (candidate) => candidate.errandTaskItemId === item.errandTaskItemId,
    );
    if (!currentItem || (currentItem.purchasedQuantity ?? 0) <= 0) return;
    const cents = parseCents(priceDrafts[item.errandTaskItemId] ?? "");
    if (cents === null) {
      toast.error("请输入不超过两位小数的有效实际单价");
      return;
    }
    const key = `price-${item.errandTaskItemId}`;
    pendingRef.current = true;
    setPendingKeys((current) => new Set(current).add(key));
    try {
      await updateActualPrice(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: currentItem.errandTaskItemId,
          actualUnitPriceCents: cents,
          itemUpdatedAt: currentItem.itemUpdatedAt,
        },
        serviceOptions,
      );
      const updated = itemsRef.current.map((candidate) =>
        candidate.errandTaskItemId === currentItem.errandTaskItemId
          ? { ...candidate, actualUnitPriceCents: cents }
          : candidate,
      );
      itemsRef.current = updated;
      setItems(updated);
      try {
        const refreshed = await getDistributingTaskDetail(
          detail.taskId,
          serviceOptions,
        );
        const refreshedItem = refreshed.items.find(
          (candidate) =>
            candidate.errandTaskItemId === currentItem.errandTaskItemId,
        );
        if (
          compareUpdatedAt(refreshed.taskUpdatedAt, taskUpdatedAt) < 0 ||
          compareUpdatedAt(
            refreshedItem?.itemUpdatedAt,
            currentItem.itemUpdatedAt,
          ) <= 0
        ) {
          throw new Error("商品单价版本未更新");
        }
        applyRefreshedDetail(refreshed);
        setPriceDrafts((current) => ({
          ...current,
          [currentItem.errandTaskItemId]: formatYuan(cents),
        }));
      } catch {
        setUnverifiedMutation({
          kind: "price",
          id: currentItem.errandTaskItemId,
          updatedAt: currentItem.itemUpdatedAt,
          items: detail.items,
          requireNewVersion: true,
        });
        toast.warning("价格已保存，但状态刷新失败，请重新进入任务");
        router.refresh();
      }
      setPriceItemId(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "价格保存失败，请刷新任务后重试",
      );
      setUnverifiedMutation({
        kind: "price",
        id: currentItem.errandTaskItemId,
        updatedAt: currentItem.itemUpdatedAt,
        items: detail.items,
        requireNewVersion: false,
      });
      setPriceItemId(null);
      router.refresh();
    } finally {
      pendingRef.current = false;
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function saveAssignment(
    item: DistributingTaskItem,
    requester: DistributingRequester,
    quantity: number,
  ) {
    if (
      pendingRef.current ||
      taskNeedsVerification ||
      mutationNeedsVerification
    )
      return;
    const currentItem = itemsRef.current.find(
      (candidate) => candidate.errandTaskItemId === item.errandTaskItemId,
    );
    const currentRequester = currentItem?.requesters.find(
      (candidate) =>
        candidate.errandTaskAssignmentId === requester.errandTaskAssignmentId,
    );
    if (!currentItem || !currentRequester) return;
    const available = getDistributionQuantityAvailable(
      currentItem,
      currentRequester.errandTaskAssignmentId,
    );
    if (
      quantity !== -1 &&
      (!Number.isInteger(quantity) || quantity < 0 || quantity > available)
    ) {
      toast.error(`分发数量应为 0 到 ${available}`);
      return;
    }
    const key = currentRequester.errandTaskAssignmentId;
    pendingRef.current = true;
    setPendingKeys((current) => new Set(current).add(key));
    try {
      const saved = await saveDistributingAssignment(
        {
          errandTaskItemId: currentItem.errandTaskItemId,
          errandTaskAssignmentId: currentRequester.errandTaskAssignmentId,
          distributedQuantity: quantity,
          assignmentUpdatedAt: currentRequester.assignmentUpdatedAt,
        },
        serviceOptions,
      );
      updateRequesterAssignment(
        currentItem.errandTaskItemId,
        currentRequester.errandTaskAssignmentId,
        quantity,
        saved.assignmentUpdatedAt ?? currentRequester.assignmentUpdatedAt,
      );
      try {
        const refreshed = await getDistributingTaskDetail(
          detail.taskId,
          serviceOptions,
        );
        const refreshedRequester = refreshed.items
          .flatMap((candidate) => candidate.requesters)
          .find(
            (candidate) =>
              candidate.errandTaskAssignmentId ===
              currentRequester.errandTaskAssignmentId,
          );
        const expectedVersion =
          saved.assignmentUpdatedAt ?? currentRequester.assignmentUpdatedAt;
        if (
          compareUpdatedAt(refreshed.taskUpdatedAt, taskUpdatedAt) < 0 ||
          compareUpdatedAt(
            refreshedRequester?.assignmentUpdatedAt,
            expectedVersion,
          ) < (saved.assignmentUpdatedAt ? 0 : 1)
        ) {
          throw new Error("分发结果版本未更新");
        }
        applyRefreshedDetail(refreshed);
      } catch {
        toast.warning("结果已保存，但状态刷新失败，请重新进入任务");
        setUnverifiedMutation({
          kind: "assignment",
          id: currentRequester.errandTaskAssignmentId,
          updatedAt:
            saved.assignmentUpdatedAt ?? currentRequester.assignmentUpdatedAt,
          items: detail.items,
          requireNewVersion: !saved.assignmentUpdatedAt,
        });
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "分发结果保存失败，请刷新后重试",
      );
      setUnverifiedMutation({
        kind: "assignment",
        id: currentRequester.errandTaskAssignmentId,
        updatedAt: currentRequester.assignmentUpdatedAt,
        items: detail.items,
        requireNewVersion: false,
      });
      router.refresh();
    } finally {
      pendingRef.current = false;
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function transition(action: Exclude<Confirmation, null>) {
    if (pendingRef.current || actionsDisabled) return;
    const packagingFeeCents =
      action === "start" ? parseCents(packagingFee) : null;
    if (action === "start") {
      if (!allPricesSaved) {
        toast.error("请先保存全部实际单价");
        return;
      }
      if (packagingFeeCents === null) {
        toast.error("请输入不超过两位小数的有效包装费");
        return;
      }
    }
    if (action === "finish" && !allProcessed) return;
    const attemptedVersion = taskUpdatedAt;
    if (!(await ensureAgreement(() => setConfirmation(null)))) return;
    if (
      pendingRef.current ||
      taskNeedsVerification ||
      mutationNeedsVerification
    )
      return;
    pendingRef.current = true;
    setPending(true);
    try {
      if (action === "start") {
        await transitionToDistributing(
          detail.taskId,
          packagingFeeCents!,
          attemptedVersion,
          serviceOptions,
        );
        toast.success("已进入分发阶段");
        setUnverifiedTaskVersion(attemptedVersion);
        router.refresh();
      } else if (action === "finish") {
        await transitionToCollectingPayment(
          detail.taskId,
          attemptedVersion,
          serviceOptions,
        );
        toast.success("已生成参与者账单");
        router.replace(buildErrandTaskPaymentHref(detail.taskId));
      } else {
        await cancelTask(detail.taskId, attemptedVersion, serviceOptions);
        toast.success("采购任务已取消，需求已回到待接单");
        router.replace("/orders?type=errand&view=captain");
      }
      setConfirmation(null);
    } catch (error) {
      setUnverifiedTaskVersion(attemptedVersion);
      setConfirmation(null);
      if (action === "finish") {
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
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "状态更新失败，请刷新任务后重试",
      );
      router.refresh();
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
            <Badge variant={getStatusBadgeVariant(mode)}>
              {getStatusLabel(mode)}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          disabled={actionsDisabled}
          onClick={() => setConfirmation("cancel")}
        >
          取消采购任务
        </Button>
      </section>

      {taskNeedsVerification || mutationNeedsVerification ? (
        <p
          role="status"
          className="rounded-lg border px-4 py-3 text-sm text-muted-foreground"
        >
          任务状态待核实，请重新进入任务查看最新结果后再操作。
        </p>
      ) : null}

      {mode === "pending_distributing" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
            <Field className="min-w-0 flex-1 basis-[28rem]">
              <FieldLabel htmlFor="packaging-fee">包装费</FieldLabel>
              <InputGroup className="max-w-64">
                <InputGroupAddon>
                  <InputGroupText>¥</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="packaging-fee"
                  value={packagingFee}
                  onChange={(event) =>
                    moneyPattern.test(event.target.value) &&
                    setPackagingFee(event.target.value)
                  }
                />
              </InputGroup>
              <p className="text-xs text-muted-foreground">
                由实际分到商品的买家均摊（不含团长），按分向上取整
              </p>
            </Field>
            <Button
              onClick={() => setConfirmation("start")}
              disabled={
                actionsDisabled ||
                !allPricesSaved ||
                parseCents(packagingFee) === null
              }
            >
              <RiCheckboxCircleLine data-icon="inline-start" />
              确认价格并开始分发
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm text-muted-foreground">分发进度</p>
              <p className="mt-1 text-lg font-semibold">
                {processedCount} 位已记录 · 共 {requesters.length} 位
              </p>
            </div>
            <Button
              disabled={!allProcessed || actionsDisabled}
              onClick={() => setConfirmation("finish")}
            >
              <RiCheckboxCircleLine data-icon="inline-start" />
              完成分发并生成账单
            </Button>
          </CardContent>
        </Card>
      )}

      {distributionGroups.map((group) => (
        <section key={group.key} className="grid min-w-0 gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <p className="text-sm text-muted-foreground">
                {group.description}
              </p>
            </div>
            <Badge variant="neutral">{group.items.length} 种</Badge>
          </div>
          <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
            {group.items.map((item) => (
              <Collapsible
                key={item.errandTaskItemId}
                open={expandedItemId === item.errandTaskItemId}
                onOpenChange={(open) =>
                  setExpandedItemId(open ? item.errandTaskItemId : null)
                }
              >
                <Card className="min-w-0 overflow-hidden">
                  <CardHeader className="flex-row items-start gap-4">
                    <ManagedImage
                      src={item.imageUrl}
                      alt={item.title}
                      className="size-20 shrink-0 rounded-lg border"
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {item.title}
                      </CardTitle>
                      {item.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm">
                        {mode === "pending_distributing"
                          ? `参考价 ${formatPrice(item.originUnitPriceCents)}`
                          : `实际 ${item.actualUnitPriceCents === null ? "待确认" : `${formatPrice(item.actualUnitPriceCents)}/件`}`}{" "}
                        {"·"} 实购 {item.purchasedQuantity ?? 0} 件
                      </p>
                    </div>
                    <div className="flex shrink-0 items-end gap-2">
                      {mode === "pending_distributing" ? (
                        item.purchasedQuantity == null ||
                        item.purchasedQuantity === 0 ? (
                          <Badge variant="neutral">未采购</Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="plain"
                            size="sm"
                            className="tabular-nums"
                            aria-label={`修改${item.title}的单价`}
                            disabled={actionsDisabled}
                            onClick={() => {
                              setPriceDrafts((current) => ({
                                ...current,
                                [item.errandTaskItemId]:
                                  item.actualUnitPriceCents === null
                                    ? ""
                                    : formatYuan(item.actualUnitPriceCents),
                              }));
                              setPriceItemId(item.errandTaskItemId);
                            }}
                          >
                            {item.actualUnitPriceCents === null
                              ? "填写单价"
                              : `实际 ${formatPrice(item.actualUnitPriceCents)}/件`}
                            <RiEditLine data-icon="inline-end" />
                          </Button>
                        )
                      ) : (
                        <Badge
                          variant={
                            item.requesters.every(isRequesterProcessed)
                              ? "success"
                              : "neutral"
                          }
                        >
                          {item.requesters.filter(isRequesterProcessed).length}/
                          {item.requesters.length} 已处理
                        </Badge>
                      )}
                      {mode === "distributing" ? (
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-controls={`distributing-item-${item.errandTaskItemId}`}
                            aria-expanded={
                              expandedItemId === item.errandTaskItemId
                            }
                          >
                            {expandedItemId === item.errandTaskItemId
                              ? "收起"
                              : "展开"}
                          </Button>
                        </CollapsibleTrigger>
                      ) : null}
                    </div>
                  </CardHeader>
                  {mode === "distributing" ? (
                    <CollapsibleContent
                      id={`distributing-item-${item.errandTaskItemId}`}
                    >
                      <CardContent className="grid gap-2 border-t pt-4">
                        {item.requesters.map((requester) => (
                          <RequesterRow
                            key={requester.errandTaskAssignmentId}
                            requester={requester}
                            maxQuantity={getDistributionQuantityAvailable(
                              item,
                              requester.errandTaskAssignmentId,
                            )}
                            draft={
                              assignmentDrafts[
                                requester.errandTaskAssignmentId
                              ] ?? ""
                            }
                            busy={actionsDisabled}
                            onDraftChange={(value) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [requester.errandTaskAssignmentId]: value,
                              }))
                            }
                            onSave={(quantity) =>
                              void saveAssignment(item, requester, quantity)
                            }
                          />
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  ) : null}
                </Card>
              </Collapsible>
            ))}
          </div>
          {group.items.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                当前没有{group.title}商品。
              </CardContent>
            </Card>
          ) : null}
        </section>
      ))}

      <Dialog
        open={priceItem !== undefined}
        onOpenChange={(open) =>
          !open && !pendingRef.current && setPriceItemId(null)
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改单价</DialogTitle>
            <DialogDescription>
              {priceItem?.title} · 开始分发后无法修改
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="actual-price">实际单价</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>¥</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="actual-price"
                autoFocus
                inputMode="decimal"
                value={
                  priceItem
                    ? (priceDrafts[priceItem.errandTaskItemId] ?? "")
                    : ""
                }
                onChange={(event) => {
                  if (priceItem && moneyPattern.test(event.target.value)) {
                    setPriceDrafts((current) => ({
                      ...current,
                      [priceItem.errandTaskItemId]: event.target.value,
                    }));
                  }
                }}
              />
            </InputGroup>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pendingKeys.size > 0}
              onClick={() => setPriceItemId(null)}
            >
              取消
            </Button>
            <Button
              disabled={
                !priceItem ||
                actionsDisabled ||
                parseCents(priceDrafts[priceItem.errandTaskItemId] ?? "") ===
                  null
              }
              onClick={() => priceItem && void savePrice(priceItem)}
            >
              {pendingKeys.size > 0 ? <Spinner /> : null}保存单价
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmation !== null}
        title={
          confirmation === "start"
            ? "开始分发"
            : confirmation === "finish"
              ? "完成全部分发"
              : "取消采购任务"
        }
        description={
          confirmation === "start"
            ? `包装费总额为 ${formatPrice(parseCents(packagingFee) ?? 0)}，确认后进入逐人分发。`
            : confirmation === "finish"
              ? "系统将按实际价格、跑腿费与包装费生成参与者账单。"
              : "取消后任务不会继续进入收款，相关需求会回到待接单状态。"
        }
        confirmLabel={
          confirmation === "start"
            ? "开始分发"
            : confirmation === "finish"
              ? "完成分发"
              : "取消采购"
        }
        pending={pending}
        destructive={confirmation === "cancel"}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => confirmation && void transition(confirmation)}
      />
    </div>
  );
}

function RequesterRow({
  requester,
  maxQuantity,
  draft,
  busy,
  onDraftChange,
  onSave,
}: {
  requester: DistributingRequester;
  maxQuantity: number;
  draft: string;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onSave: (quantity: number) => void;
}) {
  const processed = isRequesterProcessed(requester);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
      <Avatar className="size-9">
        <AvatarImage
          src={requester.purchaserAvatarUrl}
          alt={requester.purchaserName}
        />
        <AvatarFallback>
          {requester.purchaserName.trim().slice(0, 1) || "用"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {requester.purchaserName}
        </p>
        <p className="text-xs text-muted-foreground">
          应分 {requester.quantity} 件 ·{" "}
          {processed
            ? requester.distributedQuantity === 0
              ? "不分发"
              : `已分 ${requester.distributedQuantity} 件`
            : "待处理"}
        </p>
      </div>
      <form
        className="flex shrink-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() !== "") onSave(Number(draft));
        }}
      >
        <Input
          className="w-24"
          type="number"
          min={0}
          max={maxQuantity}
          value={draft}
          disabled={busy}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-label={`${requester.purchaserName}分发数量`}
        />
        <Button
          size="sm"
          type="submit"
          disabled={
            busy ||
            draft.trim() === "" ||
            !Number.isInteger(Number(draft)) ||
            Number(draft) < 0 ||
            Number(draft) > maxQuantity
          }
        >
          {busy ? <Spinner /> : null}保存
        </Button>
      </form>
      {processed ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onSave(-1)}
        >
          撤销
        </Button>
      ) : null}
    </div>
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

function isRequesterProcessed(requester: DistributingRequester): boolean {
  return requester.distributedQuantity != null;
}

function formatYuan(cents: number): string {
  return cents === 0 ? "0" : (cents / 100).toFixed(2);
}

function parseCents(value: string): number | null {
  return parseYuanToCents(value);
}
