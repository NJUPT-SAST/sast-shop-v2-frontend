"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiPriceTag3Line,
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

import { ManagedImage } from "@/components/managed-image";

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
  const pendingRef = useRef(false);
  const [items, setItems] = useState(detail.items);
  const [taskUpdatedAt, setTaskUpdatedAt] = useState(detail.taskUpdatedAt);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTaskUpdatedAt((current) => detail.taskUpdatedAt ?? current);
  }, [detail.taskUpdatedAt]);
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
  const [packagingFee, setPackagingFee] = useState(
    formatYuan(detail.packagingFeeCents),
  );
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const serviceOptions = { dataSource, connectBaseUrl };
  const requesters = useMemo(
    () => items.flatMap((item) => item.requesters),
    [items],
  );
  const processedCount = requesters.filter(isRequesterProcessed).length;
  const allProcessed =
    items.length > 0 &&
    items.every((item) => {
      if (item.purchasedQuantity == null || item.purchasedQuantity === 0) {
        return true; // 未采购，无需分发
      }
      const totalDistributed = item.requesters.reduce(
        (s, r) => s + (r.distributedQuantity ?? 0),
        0,
      );
      return totalDistributed >= item.purchasedQuantity;
    });
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
            items: items.filter(
              (item) => !item.requesters.every(isRequesterProcessed),
            ),
          },
          {
            key: "completed",
            title: "已分发",
            description: "所有参与者的分发结果均已记录。",
            items: items.filter((item) =>
              item.requesters.every(isRequesterProcessed),
            ),
          },
        ];
  const allPricesSaved = items.every(
    (item) =>
      parseCents(priceDrafts[item.errandTaskItemId] ?? "") ===
      item.actualUnitPriceCents,
  );

  function updateRequesterAssignment(
    itemId: string,
    assignmentId: string,
    distributedQuantity: number,
    assignmentUpdatedAt: string | null,
  ) {
    setItems((current) =>
      current.map((item) =>
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
                        distributedQuantity === -1
                          ? null
                          : distributedQuantity,
                      assignmentUpdatedAt,
                    },
              ),
            },
      ),
    );
    setAssignmentDrafts((current) => ({
      ...current,
      [assignmentId]:
        distributedQuantity != null && distributedQuantity > 0
          ? String(distributedQuantity)
          : "",
    }));
  }

  function applyRefreshedDetail(refreshed: DistributingTaskDetail) {
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
  }

  async function savePrice(item: DistributingTaskItem) {
    const cents = parseCents(priceDrafts[item.errandTaskItemId] ?? "");
    const key = `price-${item.errandTaskItemId}`;
    if (pendingKeys.has(key)) return;
    if (cents === null) {
      toast.error("请输入不超过两位小数的有效实际单价");
      return;
    }
    setPendingKeys((current) => new Set(current).add(key));
    try {
      await updateActualPrice(
        {
          errandTaskId: detail.taskId,
          errandTaskItemId: item.errandTaskItemId,
          actualUnitPriceCents: cents,
          itemUpdatedAt: item.itemUpdatedAt,
        },
        serviceOptions,
      );
      const refreshed = await getDistributingTaskDetail(
        detail.taskId,
        serviceOptions,
      );
      applyRefreshedDetail(refreshed);
      setPriceDrafts((current) => {
        const updated = { ...current };
        for (const entry of refreshed.items) {
          if (entry.actualUnitPriceCents != null) {
            updated[entry.errandTaskItemId] = formatYuan(
              entry.actualUnitPriceCents,
            );
          }
        }
        return updated;
      });
      toast.success("实际价格已保存");
    } catch {
      toast.error("价格保存失败，请刷新任务后重试");
    } finally {
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
    const key = requester.errandTaskAssignmentId;
    if (pendingKeys.has(key)) return;
    const remaining =
      (item.purchasedQuantity ?? 0) -
      item.requesters
        .filter((r) => r.errandTaskAssignmentId !== requester.errandTaskAssignmentId)
        .reduce((sum, r) => sum + (r.distributedQuantity ?? 0), 0);
    if (
      quantity !== -1 &&
      (!Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > remaining)
    ) {
      toast.error(`分发数量应为 0 到 ${Math.max(0, remaining)}`);
      return;
    }
    setPendingKeys((current) => new Set(current).add(key));
    try {
      const saved = await saveDistributingAssignment(
        {
          errandTaskItemId: item.errandTaskItemId,
          errandTaskAssignmentId: requester.errandTaskAssignmentId,
          distributedQuantity: quantity,
          assignmentUpdatedAt: requester.assignmentUpdatedAt,
        },
        serviceOptions,
      );
      updateRequesterAssignment(
        item.errandTaskItemId,
        requester.errandTaskAssignmentId,
        quantity,
        saved.assignmentUpdatedAt ?? requester.assignmentUpdatedAt,
      );
      toast.success(
        quantity === -1
          ? "已撤销分发结果"
          : quantity === 0
            ? "已标记不分发"
            : "分发结果已保存",
      );
    } catch {
      toast.error("分发结果保存失败，请刷新后重试");
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function transition(action: Exclude<Confirmation, null>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      if (action === "start") {
        if (!allPricesSaved || pendingKeys.size > 0) {
          toast.error("请先保存全部实际单价");
          return;
        }
        const packagingFeeCents = parseCents(packagingFee);
        if (packagingFeeCents === null) {
          toast.error("请输入不超过两位小数的有效包装费");
          return;
        }
        await transitionToDistributing(
          detail.taskId,
          packagingFeeCents,
          taskUpdatedAt,
          serviceOptions,
        );
        toast.success("已进入分发阶段");
        router.refresh();
      } else if (action === "finish") {
        await transitionToCollectingPayment(
          detail.taskId,
          taskUpdatedAt,
          serviceOptions,
        );
        toast.success("已生成参与者账单");
        router.replace(buildErrandTaskPaymentHref(detail.taskId));
      } else {
        await cancelTask(detail.taskId, taskUpdatedAt, serviceOptions);
        toast.success("采购任务已取消");
        router.replace("/orders?type=errand&view=captain");
      }
      setConfirmation(null);
    } catch {
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
        router.refresh();
      }
      toast.error("状态更新失败，请刷新任务后重试");
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
            <Badge variant="info">
              {mode === "pending_distributing" ? "待分发" : "分发中"}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          onClick={() => setConfirmation("cancel")}
        >
          取消采购任务
        </Button>
      </section>

      {mode === "pending_distributing" ? (
        <Card>
          <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
            <Field className="w-64">
              <FieldLabel htmlFor="packaging-fee">包装费总额</FieldLabel>
              <InputGroup>
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
            </Field>
            <Button
              onClick={() => setConfirmation("start")}
              disabled={
                pending ||
                pendingKeys.size > 0 ||
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
              disabled={!allProcessed || pending || pendingKeys.size > 0}
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
          {group.items.map((item) => (
            <Card
              key={item.errandTaskItemId}
              className="min-w-0 overflow-hidden"
            >
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
                    参考价 {formatPrice(item.originUnitPriceCents)} · 实购{" "}
                    {item.purchasedQuantity ?? 0} 件
                  </p>
                </div>
                <div className="flex shrink-0 items-end gap-2">
                  {mode === "pending_distributing" ? (
                    item.purchasedQuantity == null ||
                    item.purchasedQuantity === 0 ? (
                      <Badge variant="neutral">未采购</Badge>
                    ) : (
                      <div className="flex w-64 items-end gap-2">
                        <Field>
                          <FieldLabel
                            htmlFor={`actual-price-${item.errandTaskItemId}`}
                          >
                            实际单价
                          </FieldLabel>
                          <InputGroup>
                            <InputGroupAddon>
                              <InputGroupText>¥</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                              id={`actual-price-${item.errandTaskItemId}`}
                              value={priceDrafts[item.errandTaskItemId] ?? ""}
                              onChange={(event) =>
                                moneyPattern.test(event.target.value) &&
                                setPriceDrafts((current) => ({
                                  ...current,
                                  [item.errandTaskItemId]: event.target.value,
                                }))
                              }
                            />
                          </InputGroup>
                        </Field>
                        <Button
                          variant="outline"
                          disabled={
                            pendingKeys.has(`price-${item.errandTaskItemId}`) ||
                            parseCents(
                              priceDrafts[item.errandTaskItemId] ?? "",
                            ) === null
                          }
                          onClick={() => void savePrice(item)}
                        >
                          {pendingKeys.has(`price-${item.errandTaskItemId}`) ? (
                            <Spinner />
                          ) : (
                            <RiPriceTag3Line />
                          )}
                          保存
                        </Button>
                      </div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedItemId((current) =>
                          current === item.errandTaskItemId
                            ? null
                            : item.errandTaskItemId,
                        )
                      }
                      aria-expanded={expandedItemId === item.errandTaskItemId}
                    >
                      {expandedItemId === item.errandTaskItemId
                        ? "收起"
                        : "展开"}
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              {mode === "distributing" &&
              expandedItemId === item.errandTaskItemId ? (
                <CardContent className="grid gap-2 border-t pt-4">
                  {item.requesters.map((requester) => (
                    <RequesterRow
                      key={requester.errandTaskAssignmentId}
                      requester={requester}
                      maxQuantity={Math.max(
                        0,
                        (item.purchasedQuantity ?? 0) -
                          item.requesters
                            .filter(
                              (r) =>
                                r.errandTaskAssignmentId !==
                                requester.errandTaskAssignmentId,
                            )
                            .reduce(
                              (sum, r) => sum + (r.distributedQuantity ?? 0),
                              0,
                            ),
                      )}
                      draft={
                        assignmentDrafts[requester.errandTaskAssignmentId] ?? ""
                      }
                      busy={pendingKeys.has(requester.errandTaskAssignmentId)}
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
              ) : null}
            </Card>
          ))}
          {group.items.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                当前没有{group.title}商品。
              </CardContent>
            </Card>
          ) : null}
        </section>
      ))}

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
              : "取消后任务不会继续进入收款，请谨慎操作。"
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
      {processed ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onSave(-1)}
        >
          撤销
        </Button>
      ) : (
        <>
          <Input
            className="w-24"
            type="number"
            min={0}
            max={maxQuantity}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            aria-label={`${requester.purchaserName}分发数量`}
          />
          <Button
            size="sm"
            disabled={
              busy ||
              !Number.isInteger(Number(draft)) ||
              Number(draft) < 0 ||
              Number(draft) > maxQuantity
            }
            onClick={() => onSave(Number(draft))}
          >
            {busy ? <Spinner /> : null}保存
          </Button>
        </>
      )}
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
  return requester.distributedQuantity != null && requester.distributedQuantity > 0;
}

function formatYuan(cents: number): string {
  return cents === 0 ? "0" : (cents / 100).toFixed(2);
}

function parseCents(value: string): number | null {
  return parseYuanToCents(value);
}
