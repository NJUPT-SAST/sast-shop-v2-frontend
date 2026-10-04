"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RiAddLine,
  RiShoppingBag3Line,
  RiShoppingCartLine,
  RiStore2Line,
} from "@remixicon/react";
import {
  createErrandDemand,
  listProductTemplatesPage,
  type DataSource,
  type PageResult,
  type ProductTemplate,
  type ServiceOptions,
  type Store,
} from "@sast-shop/api";
import { formatPrice, parseYuanToCents } from "@sast-shop/domain";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { Input } from "@workspace/ui/components/input";
import { QuantityStepper } from "@workspace/ui/components/quantity-stepper";
import { Skeleton } from "@workspace/ui/components/skeleton";
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
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";

import {
  getDefaultErrandDeadline,
  getMinimumErrandDeadline,
  isValidErrandDeadline,
  toDateTimeLocalValue,
} from "@/lib/errand-delivery-time";
import { calculateErrandCartTotal } from "@/lib/errand-cart-total";
import { ManagedImage } from "./managed-image";
import { MobileFixedFooter } from "./mobile-fixed-footer";

type ErrandShopProps = {
  dataSource: DataSource;
  connectBaseUrl: string;
  store: Store;
  initialPage: PageResult<ProductTemplate>;
};

type ErrandCartItem = {
  template: ProductTemplate;
  quantity: number;
  serviceFeePerUnitCents: number;
};

const MAX_QUANTITY = 20;
const MONEY_DRAFT_PATTERN = /^\d*(?:\.\d{0,2})?$/;

export function ErrandShop({
  dataSource,
  connectBaseUrl,
  store,
  initialPage,
}: ErrandShopProps) {
  const router = useRouter();
  const loadPage = useCallback(
    (page: number) =>
      listProductTemplatesPage({
        dataSource,
        connectBaseUrl,
        storeId: store.id,
        page,
        pageSize: initialPage.pageSize,
      }),
    [connectBaseUrl, dataSource, initialPage.pageSize, store.id],
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
    identity: `${dataSource}:${connectBaseUrl}:${store.id}`,
  });
  const submittingRef = useRef(false);
  const [items, setItems] = useState<ErrandCartItem[]>([]);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProductTemplate | null>(null);
  const [deadlineValue, setDeadlineValue] = useState(() =>
    toDateTimeLocalValue(getDefaultErrandDeadline()),
  );
  const minimumDeadlineValue = toDateTimeLocalValue(getMinimumErrandDeadline());
  const [submitting, setSubmitting] = useState(false);

  const cartByTemplateId = useMemo(
    () => new Map(items.map((item) => [item.template.id, item])),
    [items],
  );
  const cartTotal = useMemo(
    () =>
      calculateErrandCartTotal(
        items.map((item) => ({
          quantity: item.quantity,
          priceCents: item.template.priceCents,
          serviceFeeDraft:
            feeDrafts[item.template.id] ??
            formatYuanInput(item.serviceFeePerUnitCents),
        })),
      ),
    [feeDrafts, items],
  );
  const totalCount = cartTotal.quantity;
  const totalOriginAmountCents = cartTotal.productCents;
  const totalServiceFeeCents = cartTotal.serviceFeeCents;
  const estimatedTotalCents = cartTotal.totalCents;
  const hasInvalidServiceFee = totalServiceFeeCents === null;

  const addItem = (template: ProductTemplate) => {
    setFeeDrafts((currentDrafts) =>
      template.id in currentDrafts
        ? currentDrafts
        : { ...currentDrafts, [template.id]: "" },
    );
    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.template.id === template.id,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.template.id === template.id
            ? { ...item, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) }
            : item,
        );
      }

      return [
        ...currentItems,
        { template, quantity: 1, serviceFeePerUnitCents: 0 },
      ];
    });
  };

  const updateQuantity = (templateId: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setFeeDrafts((currentDrafts) => {
        const remainingDrafts = { ...currentDrafts };

        delete remainingDrafts[templateId];

        return remainingDrafts;
      });
    }

    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.template.id === templateId
            ? {
                ...item,
                quantity: Math.min(Math.max(nextQuantity, 0), MAX_QUANTITY),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const updateServiceFeeDraft = (templateId: string, yuanValue: string) => {
    if (!MONEY_DRAFT_PATTERN.test(yuanValue)) {
      return;
    }

    setFeeDrafts((currentDrafts) => ({
      ...currentDrafts,
      [templateId]: yuanValue,
    }));
  };

  const normalizeServiceFee = (templateId: string, yuanValue: string) => {
    const nextCents = parseServiceFeeDraft(yuanValue);
    if (nextCents === null) return;

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.template.id === templateId
          ? { ...item, serviceFeePerUnitCents: nextCents }
          : item,
      ),
    );
    setFeeDrafts((currentDrafts) => ({
      ...currentDrafts,
      [templateId]: yuanValue === "" ? "" : formatYuanInput(nextCents),
    }));
  };

  const normalizeAllServiceFees = (): ErrandCartItem[] | null => {
    const normalizedItems: ErrandCartItem[] = [];
    for (const item of items) {
      const draft =
        feeDrafts[item.template.id] ??
        formatYuanInput(item.serviceFeePerUnitCents);
      const serviceFeePerUnitCents = parseServiceFeeDraft(draft);
      if (serviceFeePerUnitCents === null) return null;
      normalizedItems.push({
        ...item,
        serviceFeePerUnitCents,
      });
    }
    const normalizedDrafts = normalizedItems.reduce<Record<string, string>>(
      (drafts, item) => {
        const draft =
          feeDrafts[item.template.id] ??
          formatYuanInput(item.serviceFeePerUnitCents);

        drafts[item.template.id] =
          draft === "" ? "" : formatYuanInput(item.serviceFeePerUnitCents);

        return drafts;
      },
      {},
    );

    setItems(normalizedItems);
    setFeeDrafts(normalizedDrafts);

    return normalizedItems;
  };

  const submitDemand = async () => {
    if (submittingRef.current) {
      return;
    }

    if (items.length === 0) {
      toast.error("跑腿清单不能为空");
      return;
    }

    const normalizedItems = normalizeAllServiceFees();
    if (normalizedItems === null) {
      toast.error("跑腿费应为不超过 21474836.47 元的两位小数");
      return;
    }
    const deadline = new Date(deadlineValue);

    if (Number.isNaN(deadline.getTime()) || !isValidErrandDeadline(deadline)) {
      toast.error("期望送达时间至少需要在 2 小时后");
      return;
    }

    const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createErrandDemand(
        {
          storeId: store.id,
          deadline: deadline.toISOString(),
          items: normalizedItems.map((item) => ({
            productTemplateId: item.template.id,
            quantity: item.quantity,
            serviceFeePerUnitCents: item.serviceFeePerUnitCents,
            updatedAt: item.template.updatedAt,
          })),
        },
        serviceOptions,
      );
      toast.success("跑腿需求已发起");
      setItems([]);
      setFeeDrafts({});
      setCartOpen(false);
      router.push("/orders?type=errand");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "跑腿需求提交失败，请稍后再试",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5 py-5">
      <section className="flex items-start gap-3 rounded-lg border bg-card p-3">
        <ManagedImage
          src={store.logoUrl}
          alt={store.name}
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-7">
            {store.name}
          </h1>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm leading-5 text-muted-foreground">
            <RiStore2Line className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-2">{store.address}</span>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">选择商品</h2>

        {templates.length === 0 && !loadingMore && !hasMore ? (
          <Empty
            icon={<RiShoppingBag3Line className="size-5" />}
            title="此店铺暂无可用商品模板"
            description="可以返回团购页选择其他店铺。"
            action={
              <Button asChild size="touch" variant="outline">
                <Link href="/group">返回团购</Link>
              </Button>
            }
          />
        ) : templates.length > 0 ? (
          <div className="columns-1 gap-3 md:columns-2">
            {templates.map((template) => {
              const cartItem = cartByTemplateId.get(template.id);

              return (
                <Card
                  key={template.id}
                  className="mb-3 flex break-inside-avoid gap-3 p-3"
                >
                  <button
                    type="button"
                    disabled={submitting}
                    className="block shrink-0 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => setSelectedTemplate(template)}
                    aria-label={`查看${template.title}详情`}
                  >
                    <ManagedImage
                      src={template.mainImageUrl}
                      alt={template.title}
                      className="size-20 rounded-lg"
                    />
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5">
                        {template.title}
                      </h3>
                      {template.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {template.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums text-primary">
                          {formatPrice(template.priceCents)}
                        </p>
                      </div>

                      {cartItem ? (
                        <QuantityControl
                          title={template.title}
                          quantity={cartItem.quantity}
                          disabled={submitting}
                          onDecrement={() =>
                            updateQuantity(template.id, cartItem.quantity - 1)
                          }
                          onIncrement={() =>
                            updateQuantity(template.id, cartItem.quantity + 1)
                          }
                        />
                      ) : (
                        <Button
                          type="button"
                          size="icon-touch"
                          disabled={submitting}
                          aria-label={`将${template.title}加入跑腿清单`}
                          title="加入清单"
                          onClick={() => addItem(template)}
                        >
                          <RiAddLine />
                        </Button>
                      )}
                    </div>
                  </div>
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

      <MobileFixedFooter>
        <Button
          type="button"
          disabled={totalCount === 0}
          className="h-12 w-full justify-between px-3"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <RiShoppingCartLine className="size-5 shrink-0" />
            <span className="truncate">
              {totalCount > 0 ? `${totalCount} 件商品` : "跑腿清单"}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
            {estimatedTotalCents === null
              ? "金额待确认"
              : totalCount > 0
                ? formatPrice(estimatedTotalCents)
                : "请选择商品"}
          </span>
        </Button>
      </MobileFixedFooter>

      <ResponsiveDialog
        open={selectedTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplate(null);
        }}
      >
        {selectedTemplate ? (
          <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle>
                {selectedTemplate.title}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="sr-only">
                商品详情
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="min-h-0 overflow-y-auto">
              <div className="flex flex-col gap-4 pb-2">
                <ManagedImage
                  src={selectedTemplate.mainImageUrl}
                  alt={selectedTemplate.title}
                  className="aspect-video rounded-lg"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold text-primary">
                      {formatPrice(selectedTemplate.priceCents)}
                    </p>
                  </div>
                </div>
                {selectedTemplate.description ? (
                  <InfoRow
                    label="商品规格"
                    value={selectedTemplate.description}
                  />
                ) : null}
              </div>
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="button"
                onClick={() => {
                  addItem(selectedTemplate);
                  setSelectedTemplate(null);
                }}
              >
                <RiAddLine data-icon="inline-start" />
                加入清单
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>

      <ResponsiveDialog
        forceDrawer
        open={cartOpen}
        onOpenChange={(open) => {
          if (!submitting) setCartOpen(open);
        }}
      >
        <ResponsiveDialogContent className="max-h-[88dvh] overflow-clip px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
          <ResponsiveDialogHeader className="px-0 text-left">
            <ResponsiveDialogTitle>跑腿清单</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              商品标价不是最终支付价格，结算以团长采购结果为准。
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <Empty
                icon={<RiShoppingCartLine className="size-5" />}
                title="跑腿清单不能为空"
                description="先选择要采购的商品。"
              />
            ) : (
              <div className="flex flex-col gap-4 pb-2">
                <div className="flex flex-col divide-y rounded-lg border">
                  {items.map((item) => (
                    <div
                      key={item.template.id}
                      className="flex flex-col gap-3 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <ManagedImage
                          src={item.template.mainImageUrl}
                          alt={item.template.title}
                          className="size-14 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-5">
                            {item.template.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatPrice(item.template.priceCents)} / 件
                          </p>
                        </div>
                        <QuantityControl
                          title={item.template.title}
                          quantity={item.quantity}
                          disabled={submitting}
                          onDecrement={() =>
                            updateQuantity(item.template.id, item.quantity - 1)
                          }
                          onIncrement={() =>
                            updateQuantity(item.template.id, item.quantity + 1)
                          }
                        />
                      </div>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        跑腿费/件
                        <InputGroup>
                          <InputGroupAddon>
                            <InputGroupText>¥</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            disabled={submitting}
                            type="text"
                            inputMode="decimal"
                            value={
                              feeDrafts[item.template.id] ??
                              formatYuanInput(item.serviceFeePerUnitCents)
                            }
                            aria-label={`${item.template.title}跑腿费每件`}
                            onChange={(event) =>
                              updateServiceFeeDraft(
                                item.template.id,
                                event.target.value,
                              )
                            }
                            onBlur={(event) =>
                              normalizeServiceFee(
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
                          <span className="text-xs font-normal text-destructive">
                            金额过高，请输入不超过两位小数的有效金额
                          </span>
                        ) : null}
                      </label>
                    </div>
                  ))}
                </div>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  期望送达时间
                  <Input
                    type="datetime-local"
                    disabled={submitting}
                    min={minimumDeadlineValue}
                    value={deadlineValue}
                    onChange={(event) => setDeadlineValue(event.target.value)}
                  />
                </label>

                <div className="rounded-lg border bg-secondary/60 p-3 text-sm">
                  <TotalRow
                    label="商品标价合计"
                    value={formatPrice(totalOriginAmountCents)}
                  />
                  <TotalRow
                    label="跑腿费合计"
                    value={
                      totalServiceFeeCents === null
                        ? "待确认"
                        : formatPrice(totalServiceFeeCents)
                    }
                  />
                  <TotalRow
                    label="预估合计"
                    value={
                      estimatedTotalCents === null
                        ? "金额待确认"
                        : formatPrice(estimatedTotalCents)
                    }
                    strong
                  />
                </div>
              </div>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              className="w-full"
              disabled={
                items.length === 0 || hasInvalidServiceFee || submitting
              }
              onClick={() => {
                void submitDemand();
              }}
            >
              {submitting ? "正在提交" : "确认发起跑腿需求"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function TemplateLoadingSkeletons() {
  return (
    <div className="grid gap-3" aria-label="正在加载更多可选商品">
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} className="flex gap-3 p-3" aria-hidden="true">
          <Skeleton className="size-20 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-8 w-2/5" />
          </div>
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
  disabled,
  onDecrement,
  onIncrement,
}: {
  title: string;
  quantity: number;
  disabled: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <QuantityStepper
      className="shrink-0"
      label={`${title}数量`}
      value={quantity}
      disabled={disabled}
      min={0}
      max={MAX_QUANTITY}
      onValueChange={(next) => {
        if (next < quantity) onDecrement();
        if (next > quantity) onIncrement();
      }}
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${strong ? "text-base font-semibold" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatYuanInput(cents: number): string {
  if (cents === 0) {
    return "0";
  }

  return (cents / 100).toFixed(2);
}

function parseServiceFeeDraft(value: string): number | null {
  return value === "" ? 0 : parseYuanToCents(value);
}
