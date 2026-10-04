"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RiCheckboxBlankLine,
  RiCheckboxCircleLine,
  RiCheckboxLine,
  RiStore2Line,
  RiUser3Line,
} from "@remixicon/react";
import {
  createErrandTask,
  type DataSource,
  type ErrandDemandDetailGroup,
} from "@sast-shop/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Empty } from "@workspace/ui/components/empty";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";

import {
  calculateErrandSelectionTotals,
  toggleProductSelection,
  toggleRequesterSelection,
  type ErrandSelectionGroup,
} from "@/lib/errand-selection";
import {
  formatErrandDisplayCount,
  formatErrandDisplayPrice,
} from "@/lib/errand-display";
import { sanitizeImageSrc } from "@/lib/image-src";
import { MobileFixedFooter } from "./mobile-fixed-footer";
import { ManagedImage } from "./managed-image";

type ErrandDemandDetailProps = {
  dataSource: DataSource;
  connectBaseUrl?: string;
  storeId: string;
  storeName: string;
  details: ErrandDemandDetailGroup[];
};

export function ErrandDemandDetail({
  dataSource,
  connectBaseUrl,
  storeId,
  storeName,
  details,
}: ErrandDemandDetailProps) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectionGroups = useMemo<ErrandSelectionGroup[]>(
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
    () => calculateErrandSelectionTotals(selectionGroups, selectedIds),
    [selectionGroups, selectedIds],
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
  const canSubmit = demandItems.length > 0;
  const hasSelectableDemand = selectionGroups.some((group) =>
    group.requesters.some(
      (requester) => requester.errandDemandItemId && requester.updatedAt,
    ),
  );

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await createErrandTask(
        {
          storeId,
          demandItems,
        },
        { dataSource, connectBaseUrl },
      );

      toast.success("接单成功");
      setConfirmOpen(false);
      router.push(`/group/purchase/${result.errandTaskId}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "部分需求已被接单，请刷新后重试",
      );
      router.refresh();
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (details.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="这个店铺暂无可接单需求"
          description="可以返回跑腿采购大厅查看其他店铺。"
          action={
            <Button asChild size="touch">
              <Link href="/group/errand">查看其他店铺</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 py-6">
        <section className="space-y-1">
          <h1 className="text-xl font-semibold leading-7 md:text-2xl">
            {storeName}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            勾选完整需求行，创建采购任务。
          </p>
        </section>

        {!hasSelectableDemand ? (
          <Alert>
            <AlertTitle>暂不可接单</AlertTitle>
            <AlertDescription>
              当前需求缺少最新状态，请刷新后重试。
            </AlertDescription>
            <Button
              type="button"
              size="touch"
              variant="outline"
              onClick={() => router.refresh()}
            >
              刷新需求
            </Button>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-3">
          {details.map((group, groupIndex) => (
            <DemandProductGroup
              key={`${group.errandDemandId}-${group.productTemplate.id}`}
              group={group}
              groupIndex={groupIndex}
              selectedIds={selectedIds}
              selectionGroups={selectionGroups}
              disabled={submitting}
              onSelectProduct={(nextSelectedIds) =>
                setSelectedIds(nextSelectedIds)
              }
              onSelectRequester={(requesterId) =>
                setSelectedIds((current) =>
                  toggleRequesterSelection(current, requesterId),
                )
              }
            />
          ))}
        </section>
      </div>

      <MobileFixedFooter>
        <div className="min-w-0">
          <p className="text-xs leading-5 text-muted-foreground">
            已选 {formatErrandDisplayCount(totals.selectedRowCount)} 行 ·{" "}
            {formatErrandDisplayCount(totals.selectedQuantity)} 件
          </p>
          <p className="text-base font-semibold text-primary">
            {formatErrandDisplayPrice(totals.totalAmountCents)}
          </p>
        </div>
        <Button
          type="button"
          className="px-4"
          disabled={!canSubmit || submitting}
          onClick={() => setConfirmOpen(true)}
        >
          <RiCheckboxCircleLine data-icon="inline-start" />
          确认接单
        </Button>
      </MobileFixedFooter>

      <ResponsiveDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmOpen(open);
        }}
      >
        <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>确认接单</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="leading-6">
              已选择 {formatErrandDisplayCount(totals.selectedRowCount)}{" "}
              行需求，确认后会生成你的采购任务；未选择的需求会继续留在跑腿大厅。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">商品金额</span>
              <span className="font-medium text-primary">
                {formatErrandDisplayPrice(totals.productAmountCents)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">跑腿费</span>
              <span className="font-medium text-service-fee">
                {formatErrandDisplayPrice(totals.serviceFeeCents)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2">
              <span className="text-muted-foreground">预计合计</span>
              <span className="font-semibold text-primary">
                {formatErrandDisplayPrice(totals.totalAmountCents)}
              </span>
            </div>
          </div>

          <ResponsiveDialogFooter>
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
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "接单中" : "确认接单"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

function DemandProductGroup({
  group,
  groupIndex,
  selectedIds,
  selectionGroups,
  disabled,
  onSelectProduct,
  onSelectRequester,
}: {
  group: ErrandDemandDetailGroup;
  groupIndex: number;
  selectedIds: Set<string>;
  selectionGroups: ErrandSelectionGroup[];
  disabled: boolean;
  onSelectProduct: (selectedIds: Set<string>) => void;
  onSelectRequester: (requesterId: string) => void;
}) {
  const selectionGroup = selectionGroups[groupIndex]!;
  const selectableIds = selectionGroup.requesters
    .filter((requester) => requester.errandDemandItemId && requester.updatedAt)
    .map((requester) => requester.errandDemandItemId);
  const hasSelectableRows = selectableIds.length > 0;
  const allSelected =
    hasSelectableRows && selectableIds.every((id) => selectedIds.has(id));
  const product = group.productTemplate;
  const title = product.title;
  const productImageUrl = product.mainImageUrl;
  const productCheckboxId = `errand-product-${group.errandDemandId}-${product.id}`;

  const handleProductToggle = () => {
    onSelectProduct(toggleProductSelection(selectedIds, selectionGroup));
  };

  return (
    <Card className="overflow-hidden rounded-lg">
      <div className="flex items-start gap-3 p-3">
        <ManagedImage
          src={productImageUrl}
          alt={title}
          className={cn(
            "size-24 shrink-0 rounded-lg border",
            allSelected && "border-primary",
          )}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-h-7 items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-1 text-base font-semibold leading-5">
                {title}
              </h2>
            </div>
            <label
              htmlFor={productCheckboxId}
              className={cn(
                "flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-2 text-sm text-muted-foreground",
                (!hasSelectableRows || disabled) &&
                  "cursor-not-allowed opacity-50",
              )}
            >
              <Checkbox
                id={productCheckboxId}
                checked={allSelected}
                disabled={!hasSelectableRows || disabled}
                onCheckedChange={handleProductToggle}
              />
              <span>全选</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="min-w-[5.5rem] rounded-md bg-muted/40 px-2.5 py-1.5">
              <p className="text-xs leading-4 text-muted-foreground">
                需求总数
              </p>
              <p className="text-sm font-medium leading-5">
                {formatErrandDisplayCount(group.quantity)} 件
              </p>
            </div>
            <div className="min-w-[5.5rem] rounded-md bg-muted/40 px-2.5 py-1.5">
              <p className="text-xs leading-4 text-muted-foreground">
                估算单价
              </p>
              <p className="text-sm font-medium leading-5 text-primary">
                {formatErrandDisplayPrice(group.estimatedUnitPriceCents)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y border-t px-3">
        {group.requesters.map((requester) => (
          <RequesterRow
            key={requester.errandDemandItemId || requester.requesterId}
            requester={requester}
            selected={selectedIds.has(requester.errandDemandItemId)}
            disabled={disabled}
            onSelect={onSelectRequester}
          />
        ))}
      </div>
    </Card>
  );
}

function RequesterRow({
  requester,
  selected,
  disabled: taskSubmitting,
  onSelect,
}: {
  requester: ErrandDemandDetailGroup["requesters"][number];
  selected: boolean;
  disabled: boolean;
  onSelect: (requesterId: string) => void;
}) {
  const disabled =
    taskSubmitting || !requester.errandDemandItemId || !requester.updatedAt;
  const rowServiceFeeCents =
    requester.serviceFeePerUnitCents * requester.quantity;
  const handleSelect = () => {
    if (!disabled) {
      onSelect(requester.errandDemandItemId);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={handleSelect}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 px-2 py-3 text-left transition-colors motion-reduce:transition-none",
        selected && "bg-primary/5",
        disabled
          ? "cursor-not-allowed text-muted-foreground"
          : "cursor-pointer",
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-primary">
        {selected ? <RiCheckboxLine /> : <RiCheckboxBlankLine />}
      </span>

      <Avatar className="size-9">
        <AvatarImage
          src={sanitizeImageSrc(requester.requesterAvatarUrl) ?? undefined}
          alt={requester.requesterName}
        />
        <AvatarFallback className="text-xs">
          {requester.requesterName.trim() ? (
            nameInitial(requester.requesterName)
          ) : (
            <RiUser3Line className="size-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {requester.requesterName ? (
            <span className="max-w-32 truncate text-sm font-medium text-foreground">
              {requester.requesterName}
            </span>
          ) : null}
          <span
            className={cn(
              requester.requesterName
                ? "text-xs text-muted-foreground"
                : "text-sm font-medium text-foreground",
            )}
          >
            {formatErrandDisplayCount(requester.quantity)} 件
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          截止 {formatDeadline(requester.deadline)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-service-fee">
          跑腿 {formatErrandDisplayPrice(rowServiceFeeCents)}
        </p>
      </div>
    </button>
  );
}

function nameInitial(name: string): string {
  const normalizedName = name.trim();

  return normalizedName.slice(0, 1).toUpperCase();
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) {
    return "未设置";
  }

  const date = new Date(deadline);

  if (Number.isNaN(date.getTime())) {
    return "未设置";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}
