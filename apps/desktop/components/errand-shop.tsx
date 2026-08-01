"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; //提交成功后跳转到订单跑腿页
import {
  //Remix Icon 图标
  RiAddLine, //加号
  RiArrowLeftLine, //返回箭头
  RiShoppingBag3Line, //购物袋
  RiShoppingCartLine, //购物车图标
} from "@remixicon/react";
import {
  createErrandDemand,
  listProductTemplatesPage, //分页拉取店铺商品模板（左侧商品列表
  type DataSource, // 多环境区分表示，内部接口通用参数
  type PageResult, // 分页接口标准返回结构
  type ProductTemplate,
  type Store,
} from "@sast-shop/api";
import {
  formatPrice,
  getDefaultErrandDeadline,
  getMinimumErrandDeadline,
  isValidErrandDeadline,
  parseYuanToCents,
  toDateTimeLocalValue,
} from "@sast-shop/domain";
import { Button } from "@workspace/ui/components/button";
// 展示商品列表，订单摘要，价格汇总面板
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
// 创建确认弹窗，详情弹窗，提示弹窗
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { QuantityStepper } from "@workspace/ui/components/quantity-stepper";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import { toast } from "sonner";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";

import { ManagedImage } from "@/components/managed-image";
type CartItem = {
  template: ProductTemplate;
  quantity: number;
  serviceFeePerUnitCents: number;
};

const MAX_QUANTITY = 20;
const moneyPattern = /^\d*(?:\.\d{0,2})?$/;

export function ErrandShop({
  dataSource,
  connectBaseUrl,
  store,
  initialPage,
  error,
}: {
  dataSource: DataSource;
  connectBaseUrl?: string;
  store: Store | null;
  initialPage: PageResult<ProductTemplate>;
  error: string | null;
}) {
  const router = useRouter();
  const loadPage = useCallback(
    (page: number) => {
      if (!store) return Promise.resolve(initialPage);
      return listProductTemplatesPage({
        dataSource,
        connectBaseUrl,
        storeId: store.id,
        page,
        pageSize: initialPage.pageSize,
      });
    },
    [connectBaseUrl, dataSource, initialPage, store],
  );
  const {
    items: templates,
    loadingMore,
    loadMoreError,
    hasMore,
    totalCount: availableTotalCount,
    loadMore,
  } = useInfinitePage({
    initialPage,
    loadPage,
    getKey: getTemplateKey,
    identity: `${dataSource}:${connectBaseUrl}:${store?.id ?? "none"}`,
  });
  const submittingRef = useRef(false); //ref存储提交锁，防止用户多次点击提交
  const [items, setItems] = useState<CartItem[]>([]);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [deadlineValue, setDeadlineValue] = useState(() =>
    toDateTimeLocalValue(getDefaultErrandDeadline()),
  );
  const minimumDeadlineValue = toDateTimeLocalValue(getMinimumErrandDeadline());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cartById = useMemo(
    () => new Map(items.map((item) => [item.template.id, item])),
    [items],
  );
  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        serviceFeePerUnitCents:
          parseServiceFeeDraft(
            feeDrafts[item.template.id] ??
              formatYuanInput(item.serviceFeePerUnitCents),
          ) ?? 0,
      })),
    [feeDrafts, items],
  );
  const hasInvalidServiceFee = items.some(
    (item) =>
      parseServiceFeeDraft(
        feeDrafts[item.template.id] ??
          formatYuanInput(item.serviceFeePerUnitCents),
      ) === null,
  );
  const totalQuantity = normalizedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const goodsAmount = normalizedItems.reduce(
    (total, item) => total + item.template.priceCents * item.quantity,
    0,
  );
  const serviceFee = normalizedItems.reduce(
    (total, item) => total + item.serviceFeePerUnitCents * item.quantity,
    0,
  );

  if (error) {
    return (
      <LoadFailure
        variant="page"
        title="店铺商品加载失败"
        description={error}
        onRetry={() => router.refresh()}
        secondaryAction={
          <Button asChild variant="outline">
            <Link href="/group">返回团购工作台</Link>
          </Button>
        }
      />
    );
  }

  if (!store) {
    return (
      <Empty
        icon={<RiShoppingBag3Line className="size-5" />}
        title="没有找到店铺"
        action={
          <Button asChild variant="outline">
            <Link href="/group">返回团购工作台</Link>
          </Button>
        }
      />
    );
  }

  const storeId = store.id;

  function updateQuantity(template: ProductTemplate, nextQuantity: number) {
    setItems((current) => {
      const exists = current.some((item) => item.template.id === template.id);
      if (!exists && nextQuantity > 0) {
        return [
          ...current,
          { template, quantity: 1, serviceFeePerUnitCents: 0 },
        ];
      }
      return current
        .map((item) =>
          item.template.id === template.id
            ? {
                ...item,
                quantity: Math.min(Math.max(nextQuantity, 0), MAX_QUANTITY),
              }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
    if (nextQuantity <= 0) {
      setFeeDrafts((current) => {
        const next = { ...current };
        delete next[template.id];
        return next;
      });
    }
  }

  function updateFeeDraft(templateId: string, value: string) {
    if (!moneyPattern.test(value)) return;
    setFeeDrafts((current) => ({ ...current, [templateId]: value }));
  }

  function openConfirmation() {
    if (items.length === 0) {
      toast.error("请先选择商品");
      return;
    }
    if (hasInvalidServiceFee) {
      toast.error("跑腿费应为不超过 21474836.47 元的两位小数");
      return;
    }
    const deadline = new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime()) || !isValidErrandDeadline(deadline)) {
      toast.error("期望送达时间至少需要在 2 小时后");
      return;
    }
    setConfirmOpen(true);
  }

  async function submitDemand() {
    if (submittingRef.current || normalizedItems.length === 0) return;
    const deadline = new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime()) || !isValidErrandDeadline(deadline)) {
      toast.error("期望送达时间至少需要在 2 小时后");
      setConfirmOpen(false);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createErrandDemand(
        {
          storeId,
          deadline: deadline.toISOString(),
          items: normalizedItems.map((item) => ({
            productTemplateId: item.template.id,
            quantity: item.quantity,
            serviceFeePerUnitCents: item.serviceFeePerUnitCents,
            updatedAt: item.template.updatedAt,
          })),
        },
        { dataSource, connectBaseUrl },
      );
      toast.success("跑腿需求已发起");
      setConfirmOpen(false);
      router.push("/orders?type=errand&view=participant");
    } catch {
      toast.error("跑腿需求提交失败，请稍后再试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <ManagedImage
            src={store.logoUrl}
            alt={store.name}
            className="size-16 shrink-0 rounded-xl border"
          />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              {store.name}
            </h1>
            {store.address ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {store.address}
              </p>
            ) : null}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/group">
            <RiArrowLeftLine data-icon="inline-start" />
            返回团购工作台
          </Link>
        </Button>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0 space-y-4">
          <h2 className="text-xl font-semibold">选择商品</h2>
          {templates.length === 0 && !loadingMore && !hasMore ? (
            <Empty
              icon={<RiShoppingBag3Line className="size-5" />}
              title="此店铺暂无可选商品"
            />
          ) : templates.length > 0 ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {templates.map((template) => {
                const cartItem = cartById.get(template.id);
                return (
                  <Card key={template.id} className="min-w-0 overflow-hidden">
                    <CardContent className="flex min-w-0 gap-4 p-4">
                      <ManagedImage
                        src={template.mainImageUrl}
                        alt={template.title}
                        className="size-24 shrink-0 rounded-lg border"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="line-clamp-2 font-semibold">
                          {template.title}
                        </h3>
                        {template.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {template.description}
                          </p>
                        ) : null}
                        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                          <span className="font-semibold text-primary">
                            {formatPrice(template.priceCents)}
                          </span>
                          {cartItem ? (
                            <QuantityControl
                              title={template.title}
                              quantity={cartItem.quantity}
                              onDecrement={() =>
                                updateQuantity(template, cartItem.quantity - 1)
                              }
                              onIncrement={() =>
                                updateQuantity(template, cartItem.quantity + 1)
                              }
                            />
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => updateQuantity(template, 1)}
                            >
                              <RiAddLine data-icon="inline-start" />
                              加入清单
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}

          <InfiniteListStatus
            hasMore={hasMore}
            loading={loadingMore}
            error={loadMoreError}
            hasItems={availableTotalCount > 0}
            onLoadMore={() => void loadMore()}
            loadingFallback={<TemplateLoadingSkeletons />}
            endMessage={`已经到底，共 ${templates.length} 个可选商品`}
          />
        </section>

        <aside className="min-w-0">
          <Card className="sticky top-24 max-h-[calc(100dvh-7rem)] min-w-0 overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <RiShoppingCartLine className="size-5" />
                跑腿清单
              </CardTitle>
              {items.length > 0 ? (
                <CardDescription>
                  {items.length} 种 · {totalQuantity} 件
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="app-scrollbar max-h-[calc(100dvh-18rem)] space-y-4 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  从左侧选择需要代购的商品。
                </p>
              ) : (
                <div className="grid gap-4">
                  {items.map((item) => (
                    <div
                      key={item.template.id}
                      className="grid gap-3 rounded-lg border p-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.template.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatPrice(item.template.priceCents)} / 件
                          </p>
                        </div>
                        <QuantityControl
                          title={item.template.title}
                          quantity={item.quantity}
                          onDecrement={() =>
                            updateQuantity(item.template, item.quantity - 1)
                          }
                          onIncrement={() =>
                            updateQuantity(item.template, item.quantity + 1)
                          }
                        />
                      </div>
                      <Field>
                        <FieldLabel htmlFor={`fee-${item.template.id}`}>
                          单件跑腿费
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <InputGroupText>¥</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            id={`fee-${item.template.id}`}
                            inputMode="decimal"
                            value={
                              feeDrafts[item.template.id] ??
                              formatYuanInput(item.serviceFeePerUnitCents)
                            }
                            onChange={(event) =>
                              updateFeeDraft(
                                item.template.id,
                                event.target.value,
                              )
                            }
                          />
                        </InputGroup>
                        {parseServiceFeeDraft(
                          feeDrafts[item.template.id] ??
                            formatYuanInput(item.serviceFeePerUnitCents),
                        ) === null ? (
                          <p className="text-xs text-destructive">
                            金额过高，请输入不超过两位小数的有效金额
                          </p>
                        ) : null}
                      </Field>
                    </div>
                  ))}
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="errand-deadline">期望送达时间</FieldLabel>
                <Input
                  id="errand-deadline"
                  type="datetime-local"
                  min={minimumDeadlineValue}
                  value={deadlineValue}
                  onChange={(event) => setDeadlineValue(event.target.value)}
                />
              </Field>

              <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <TotalRow label="商品标价" value={goodsAmount} />
                <TotalRow label="跑腿费" value={serviceFee} />
                <TotalRow
                  label="预估合计"
                  value={goodsAmount + serviceFee}
                  strong
                />
                <p className="border-t pt-2 text-xs text-muted-foreground">
                  实际金额以团长采购结果为准
                </p>
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={
                  items.length === 0 || hasInvalidServiceFee || submitting
                }
                onClick={openConfirmation}
              >
                确认发起需求
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认发起跑腿需求？</DialogTitle>
            <DialogDescription>
              {items.length} 种 · {totalQuantity} 件，提交后将进入跑腿大厅。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <TotalRow label="商品标价" value={goodsAmount} />
            <TotalRow label="跑腿费" value={serviceFee} />
            <TotalRow
              label="预估合计"
              value={goodsAmount + serviceFee}
              strong
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              返回修改
            </Button>
            <Button type="button" disabled={submitting} onClick={submitDemand}>
              {submitting ? "正在提交…" : "发起需求"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateLoadingSkeletons() {
  return (
    <div
      className="grid min-w-0 gap-4 lg:grid-cols-2"
      aria-label="正在加载更多可选商品"
    >
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} aria-hidden="true">
          <CardContent className="flex gap-4 p-4">
            <Skeleton className="size-24 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-8 w-2/5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getTemplateKey(template: ProductTemplate) {
  return template.id;
}

function QuantityControl({
  title,
  quantity,
  onDecrement,
  onIncrement,
}: {
  title: string;
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <QuantityStepper
      className="shrink-0"
      label={`${title}数量`}
      value={quantity}
      min={0}
      max={MAX_QUANTITY}
      onValueChange={(next) => {
        if (next < quantity) onDecrement();
        if (next > quantity) onIncrement();
      }}
    />
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-primary" : "font-medium"}>
        {formatPrice(value)}
      </span>
    </div>
  );
}

function formatYuanInput(cents: number): string {
  return cents === 0 ? "0" : (cents / 100).toFixed(2);
}

function parseServiceFeeDraft(value: string): number | null {
  return value === "" ? 0 : parseYuanToCents(value);
}
