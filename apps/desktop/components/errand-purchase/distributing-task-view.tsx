"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiPriceTag3Line,
} from "@remixicon/react";
import {
  cancelTask,
  getDistributingTaskDetail,
  saveDistributingAssignment,
  transitionToCollectingPayment,
  transitionToDistributing,
  updateActualPrice,
  type DataSource,
  type DistributingRequester,
  type DistributingTaskDetail,
  type DistributingTaskItem,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
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
const maxInt32 = 2_147_483_647;

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
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      detail.items.map((item) => [
        item.errandTaskItemId,
        formatYuan(item.actualUnitPriceCents),
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
          requester.distributedQuantity > 0
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
  const serviceOptions = { dataSource, connectBaseUrl };
  const requesters = useMemo(
    () => items.flatMap((item) => item.requesters),
    [items],
  );
  const processedCount = requesters.filter(isRequesterProcessed).length;
  const allProcessed =
    requesters.length > 0 && processedCount === requesters.length;
  const allPricesSaved = items.every(
    (item) =>
      parseCents(priceDrafts[item.errandTaskItemId] ?? "") ===
      item.actualUnitPriceCents,
  );

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
        detail.taskId,
        item.errandTaskItemId,
        cents,
        null,
        serviceOptions,
      );
      const refreshed = await getDistributingTaskDetail(
        detail.taskId,
        serviceOptions,
      );
      setItems(refreshed.items);
      setPriceDrafts(
        Object.fromEntries(
          refreshed.items.map((entry) => [
            entry.errandTaskItemId,
            formatYuan(entry.actualUnitPriceCents),
          ]),
        ),
      );
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
    if (
      quantity !== -1 &&
      (!Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > requester.quantity)
    ) {
      toast.error(`分发数量应为 0 到 ${requester.quantity}`);
      return;
    }
    setPendingKeys((current) => new Set(current).add(key));
    try {
      await saveDistributingAssignment(
        {
          errandTaskItemId: item.errandTaskItemId,
          errandTaskAssignmentId: requester.errandTaskAssignmentId,
          distributedQuantity: quantity,
          assignmentUpdatedAt: requester.assignmentUpdatedAt,
        },
        serviceOptions,
      );
      const refreshed = await getDistributingTaskDetail(
        detail.taskId,
        serviceOptions,
      );
      setItems(refreshed.items);
      setAssignmentDrafts(
        Object.fromEntries(
          refreshed.items.flatMap((entry) =>
            entry.requesters.map((candidate) => [
              candidate.errandTaskAssignmentId,
              candidate.distributedQuantity > 0
                ? String(candidate.distributedQuantity)
                : "",
            ]),
          ),
        ),
      );
      toast.success(quantity === 0 ? "已撤销分发结果" : "分发结果已保存");
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
          null,
          serviceOptions,
        );
        toast.success("已进入分发阶段");
        router.refresh();
      } else if (action === "finish") {
        await transitionToCollectingPayment(
          detail.taskId,
          null,
          serviceOptions,
        );
        toast.success("已生成参与者账单");
        router.refresh();
      } else {
        await cancelTask(detail.taskId, null, serviceOptions);
        toast.success("采购任务已取消");
        router.replace(buildErrandTaskPaymentHref(detail.taskId));
      }
      setConfirmation(null);
    } catch {
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
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "pending_distributing"
              ? "核对实际单价与包装费，然后开始分发。"
              : "按参与者记录分发数量，全部处理后生成收款账单。"}
          </p>
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
                {processedCount} / {requesters.length} 位参与者
              </p>
            </div>
            <Button
              disabled={!allProcessed || pending}
              onClick={() => setConfirmation("finish")}
            >
              <RiCheckboxCircleLine data-icon="inline-start" />
              完成分发并生成账单
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid min-w-0 gap-4">
        {items.map((item) => (
          <Card key={item.errandTaskItemId} className="min-w-0 overflow-hidden">
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
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {item.description || "暂无规格说明"}
                </p>
                <p className="mt-2 text-sm">
                  参考价 {formatPrice(item.originUnitPriceCents)} · 实购{" "}
                  {item.requesters.reduce(
                    (total, requester) => total + requester.quantity,
                    0,
                  )}{" "}
                  件
                </p>
              </div>
              {mode === "pending_distributing" ? (
                <div className="flex w-64 shrink-0 items-end gap-2">
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
                      parseCents(priceDrafts[item.errandTaskItemId] ?? "") ===
                        null
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
            </CardHeader>
            {mode === "distributing" ? (
              <CardContent className="grid gap-2 border-t pt-4">
                {item.requesters.map((requester) => (
                  <RequesterRow
                    key={requester.errandTaskAssignmentId}
                    requester={requester}
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
      </section>

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
  draft,
  busy,
  onDraftChange,
  onSave,
}: {
  requester: DistributingRequester;
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
            ? requester.distributedQuantity === -1
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
          onClick={() => onSave(0)}
        >
          撤销
        </Button>
      ) : (
        <>
          <Input
            className="w-24"
            type="number"
            min={0}
            max={requester.quantity}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            aria-label={`${requester.purchaserName}分发数量`}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onSave(-1)}
          >
            <RiCloseCircleLine data-icon="inline-start" />
            不分发
          </Button>
          <Button
            size="sm"
            disabled={
              busy ||
              !Number.isInteger(Number(draft)) ||
              Number(draft) <= 0 ||
              Number(draft) > requester.quantity
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
  return (
    requester.distributedQuantity > 0 || requester.distributedQuantity === -1
  );
}

function formatYuan(cents: number): string {
  return cents === 0 ? "0" : (cents / 100).toFixed(2);
}

function parseCents(value: string): number | null {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= maxInt32
    ? cents
    : null;
}
