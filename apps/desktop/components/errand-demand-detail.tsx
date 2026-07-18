"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiStore2Line,
  RiUser3Line,
} from "@remixicon/react";
import {
  createErrandTask,
  type DataSource,
  type ErrandDemandDetailGroup,
} from "@sast-shop/api";
import {
  calculateErrandSelectionTotals,
  formatErrandDisplayCount,
  formatPrice,
  toggleProductSelection,
  toggleRequesterSelection,
  type ErrandSelectionGroup,
} from "@sast-shop/domain";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Empty } from "@workspace/ui/components/empty";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

import { ManagedImage } from "@/components/managed-image";

export function ErrandDemandDetail({
  dataSource,
  connectBaseUrl,
  storeId,
  storeName,
  details,
  error,
}: {
  dataSource: DataSource;
  connectBaseUrl?: string;
  storeId: string;
  storeName: string;
  details: ErrandDemandDetailGroup[];
  error: string | null;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const groups = useMemo<ErrandSelectionGroup[]>(
    () =>
      details.map((group) => ({
        productId: group.productTemplate.id,
        estimatedUnitPriceCents: group.estimatedUnitPriceCents,
        requesters: group.requesters.map((requester) => ({
          errandDemandItemId: requester.errandDemandItemId,
          quantity: requester.quantity,
          serviceFeePerUnitCents: requester.serviceFeePerUnitCents,
          updatedAt: requester.updatedAt,
        })),
      })),
    [details],
  );
  const totals = useMemo(
    () => calculateErrandSelectionTotals(groups, selectedIds),
    [groups, selectedIds],
  );
  const demandItems = useMemo(
    () =>
      details.flatMap((group) =>
        group.requesters.flatMap((requester) =>
          requester.errandDemandItemId &&
          requester.updatedAt &&
          selectedIds.has(requester.errandDemandItemId)
            ? [
                {
                  errandDemandItemId: requester.errandDemandItemId,
                  updatedAt: requester.updatedAt,
                },
              ]
            : [],
        ),
      ),
    [details, selectedIds],
  );

  async function submitTask() {
    if (submitting || demandItems.length === 0) return;
    setSubmitting(true);
    try {
      const result = await createErrandTask(
        { storeId, demandItems },
        { dataSource, connectBaseUrl },
      );
      toast.success("接单成功，已创建采购任务");
      setConfirmOpen(false);
      router.push(`/group/purchase/${result.errandTaskId}`);
    } catch {
      toast.error("部分需求可能已被接单，请刷新后重试");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (error || details.length === 0) {
    return (
      <Empty
        icon={<RiStore2Line className="size-5" />}
        title={error ? "需求详情暂不可用" : "这个店铺暂无可接单需求"}
        description={error ?? "可以返回跑腿大厅查看其他店铺。"}
        action={
          <Button asChild variant="outline">
            <Link href="/group/errand">返回跑腿大厅</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{storeName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            每行需求需整行承接
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/group/errand">
            <RiArrowLeftLine data-icon="inline-start" />
            返回大厅
          </Link>
        </Button>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        {details.map((group, index) => (
          <DemandGroupCard
            key={`${group.errandDemandId}-${group.productTemplate.id}`}
            group={group}
            selectionGroup={groups[index]!}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
          />
        ))}
      </section>

      <Card className="sticky bottom-4 z-10 border-primary/20 bg-card/95 shadow-lg backdrop-blur-xl">
        <CardContent className="flex min-w-0 flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              已选 {formatErrandDisplayCount(totals.selectedRowCount)} 行 ·{" "}
              {formatErrandDisplayCount(totals.selectedQuantity)} 件
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xl font-semibold text-primary">
                {formatPrice(totals.totalAmountCents)}
              </span>
              <span className="text-sm text-muted-foreground">
                商品 {formatPrice(totals.productAmountCents)} · 跑腿费{" "}
                {formatPrice(totals.serviceFeeCents)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            disabled={demandItems.length === 0 || submitting}
            onClick={() => setConfirmOpen(true)}
          >
            <RiCheckboxCircleLine data-icon="inline-start" />
            确认接单
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认领取这些需求？</DialogTitle>
            <DialogDescription>
              将创建包含 {formatErrandDisplayCount(totals.selectedRowCount)}{" "}
              行、
              {formatErrandDisplayCount(totals.selectedQuantity)}{" "}
              件商品的采购任务。 未选择的需求会继续留在大厅。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <AmountRow label="预计商品金额" value={totals.productAmountCents} />
            <AmountRow label="跑腿费" value={totals.serviceFeeCents} />
            <AmountRow
              label="预计合计"
              value={totals.totalAmountCents}
              emphasized
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={submitting || demandItems.length === 0}
              onClick={submitTask}
            >
              {submitting ? "接单中…" : "确认接单"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DemandGroupCard({
  group,
  selectionGroup,
  selectedIds,
  onSelectedIdsChange,
}: {
  group: ErrandDemandDetailGroup;
  selectionGroup: ErrandSelectionGroup;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
}) {
  const selectableIds = selectionGroup.requesters
    .filter((requester) => requester.errandDemandItemId && requester.updatedAt)
    .map((requester) => requester.errandDemandItemId);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));
  const product = group.productTemplate;
  const title = product.title;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex-row items-start gap-4">
        <ManagedImage
          src={product.mainImageUrl}
          alt={title}
          className="size-20 shrink-0 rounded-lg border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <CardTitle className="min-w-0 truncate text-base">
              {title}
            </CardTitle>
            <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allSelected}
                disabled={selectableIds.length === 0}
                onCheckedChange={() =>
                  onSelectedIdsChange(
                    toggleProductSelection(selectedIds, selectionGroup),
                  )
                }
              />
              全选
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {formatErrandDisplayCount(group.quantity)} 件需求
            </Badge>
            <Badge variant="muted">
              估算单价 {formatPrice(group.estimatedUnitPriceCents)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 border-t pt-4">
        {group.requesters.map((requester) => {
          const id = requester.errandDemandItemId;
          const disabled = !id || !requester.updatedAt;
          const selected = selectedIds.has(id);
          const toggle = () => {
            if (!disabled) {
              onSelectedIdsChange(toggleRequesterSelection(selectedIds, id));
            }
          };

          return (
            <div
              key={id || requester.requesterId}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              aria-pressed={selected}
              onClick={toggle}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle();
                }
              }}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                selected && "border-primary bg-primary/5",
                disabled
                  ? "cursor-not-allowed bg-muted/40 text-muted-foreground"
                  : "cursor-pointer hover:bg-muted/30",
              )}
            >
              <Checkbox
                checked={selected}
                disabled={disabled}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={toggle}
                aria-label={
                  requester.requesterName
                    ? `选择${requester.requesterName}的需求`
                    : "选择该商品需求"
                }
              />
              <Avatar className="size-9">
                <AvatarFallback>
                  {requester.requesterName.trim() ? (
                    nameInitial(requester.requesterName)
                  ) : (
                    <RiUser3Line className="size-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {requester.requesterName ? (
                  <p className="truncate text-sm font-medium">
                    {requester.requesterName}
                  </p>
                ) : null}
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {formatErrandDisplayCount(requester.quantity)} 件 · 截止{" "}
                  {formatDeadline(requester.deadline)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium">
                跑腿费{" "}
                {formatPrice(
                  requester.serviceFeePerUnitCents * requester.quantity,
                )}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AmountRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={emphasized ? "font-semibold text-primary" : "font-medium"}
      >
        {formatPrice(value)}
      </span>
    </div>
  );
}

function nameInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

function formatDeadline(value: string | null): string {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
