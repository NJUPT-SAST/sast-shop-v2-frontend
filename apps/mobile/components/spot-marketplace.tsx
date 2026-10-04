"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiCheckboxCircleLine,
  RiSearchLine,
  RiShoppingBag3Line,
  RiStore2Line,
} from "@remixicon/react";
import {
  createSpotOrders,
  getBill,
  getSpotGoods,
  listSpotGoods,
  listPaymentQrCodes,
  payBill,
  type DataSource,
  type ListSpotGoodsResult,
  type PaymentBill,
  type ServiceOptions,
  type SpotGoods,
  type SpotGoodsBrief,
} from "@sast-shop/api";
import { formatPrice, hasMoreSpotGoods } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
import { InfiniteListStatus } from "@workspace/ui/components/infinite-list-status";
import { LoadFailure } from "@workspace/ui/components/load-failure";
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
import { Spinner } from "@workspace/ui/components/spinner";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { QuantityStepper } from "@workspace/ui/components/quantity-stepper";
import { toast } from "sonner";
import { useInfinitePage } from "@workspace/ui/hooks/use-infinite-page";

import {
  readDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences";
import { ManagedImage } from "./managed-image";
import { PaymentDialog, type PaymentDialogStatus } from "./payment-dialog";

type SpotProductBrief = {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  barcode: string;
  imageUrl: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
};

type SpotProduct = SpotProductBrief & {
  stock: number;
  sellerId: string;
  seller: string;
  sellerAvatarUrl: string;
  updatedAt: string;
};

type CheckoutDraft = {
  product: SpotProduct;
  quantity: number;
  status: PaymentDialogStatus;
  bill: PaymentBill | null;
  errorMessage?: string;
};

export function SpotMarketplace({
  dataSource,
  connectBaseUrl,
  initialPage,
  error,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  initialPage: ListSpotGoodsResult;
  error: string | null;
}) {
  const router = useRouter();
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl };
  const firstPage = useMemo(
    () => ({
      items: initialPage.goods,
      currentPage: initialPage.currentPage,
      pageSize: initialPage.pageSize,
      totalCount: initialPage.totalCount,
      hasMore: hasMoreSpotGoods(initialPage),
    }),
    [initialPage],
  );
  const loadPage = useCallback(
    async (page: number) => {
      const result = await listSpotGoods({
        dataSource,
        connectBaseUrl,
        page,
        pageSize: initialPage.pageSize,
      });
      return {
        items: result.goods,
        currentPage: result.currentPage,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        hasMore: hasMoreSpotGoods(result),
      };
    },
    [connectBaseUrl, dataSource, initialPage.pageSize],
  );
  const {
    items: loadedGoods,
    loadingMore,
    loadMoreError,
    hasMore,
    totalCount,
    loadMore,
  } = useInfinitePage({
    initialPage: firstPage,
    loadPage,
    getKey: getSpotGoodsKey,
    identity: `${dataSource}:${connectBaseUrl}`,
  });

  const spotGoods = useMemo(
    () =>
      loadedGoods.map((goods) => ({
        id: goods.id,
        title: goods.product.title,
        description: goods.product.description,
        price: goods.salePriceCents,
        originalPrice: goods.product.priceCents,
        barcode: goods.product.barcode,
        imageUrl: goods.product.mainImageUrl,
        storeId: goods.store.id,
        storeName: goods.store.name,
        storeAddress: goods.store.address,
      })),
    [loadedGoods],
  );
  const [selectedBrief, setSelectedBrief] = useState<SpotProductBrief | null>(
    null,
  );
  const [selectedProduct, setSelectedProduct] = useState<SpotProduct | null>(
    null,
  );
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [query, setQuery] = useState("");
  const [defaultPlatform, setDefaultPlatform] =
    useState<PaymentPlatform>("wechat");
  const [paymentQrCodes, setPaymentQrCodes] = useState<
    Partial<Record<PaymentPlatform, string>>
  >({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const checkoutRef = useRef(false);
  const checkoutGenerationRef = useRef(0);
  const detailRequestRef = useRef(0);
  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();

    if (!keyword) {
      return spotGoods;
    }

    return spotGoods.filter((product) =>
      [
        product.title,
        product.description,
        product.storeName,
        product.barcode,
      ].some((value) => value.toLocaleLowerCase().includes(keyword)),
    );
  }, [spotGoods, query]);
  useEffect(() => {
    if (!query.trim() || !hasMore || loadMoreError) return;
    const timeout = window.setTimeout(() => {
      void loadMore();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [hasMore, loadMore, loadMoreError, query]);

  const maxQuantity = selectedProduct?.stock ?? 1;
  const isOutOfStock = selectedProduct?.stock === 0;

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(() => {
      if (isMounted) {
        setDefaultPlatform(readDefaultPaymentPlatform());
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  function closeDetail() {
    detailRequestRef.current += 1;
    setSelectedBrief(null);
    setSelectedProduct(null);
    setDetailStatus("idle");
    setQuantity(1);
  }

  function closeCheckout() {
    checkoutGenerationRef.current += 1;
    setCheckoutDraft(null);
  }

  async function openDetail(product: SpotProductBrief) {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedBrief(product);
    setSelectedProduct(null);
    setDetailStatus("loading");
    setQuantity(1);

    try {
      const detail = await getSpotGoods(product.id, serviceOptions);
      if (
        detailRequestRef.current !== requestId ||
        detail.product.storeId !== product.storeId
      ) {
        if (detailRequestRef.current === requestId) setDetailStatus("error");
        return;
      }

      setSelectedProduct(mapSpotProductDetail(product, detail));
      setDetailStatus("idle");
    } catch {
      if (detailRequestRef.current === requestId) setDetailStatus("error");
    }
  }

  async function startCheckout() {
    if (!selectedProduct) return;

    await beginCheckout(selectedProduct, quantity);
  }

  async function beginCheckout(product: SpotProduct, checkoutQuantity: number) {
    if (checkoutRef.current || submittingRef.current) return;
    checkoutRef.current = true;
    const generation = ++checkoutGenerationRef.current;
    const currentDefaultPlatform = readDefaultPaymentPlatform();

    setDefaultPlatform(currentDefaultPlatform);
    setPaymentQrCodes({});
    setCheckoutDraft({
      product,
      quantity: checkoutQuantity,
      status: "loading",
      bill: null,
    });
    closeDetail();
    setSubmitted(false);
    setSubmitting(true);

    let createdBill: PaymentBill | null = null;

    try {
      const createdOrders = await createSpotOrders(
        [
          {
            spotGoodsId: product.id,
            quantity: checkoutQuantity,
            updatedAt: product.updatedAt,
          },
        ],
        serviceOptions,
      );
      const createdOrder = createdOrders[0];
      const createdPayeeId = createdOrder?.bill?.payee?.id;

      if (!createdOrder?.bill?.updatedAt || !createdPayeeId) {
        throw new Error("missing bill");
      }

      const payeeId = createdPayeeId;

      if (product.sellerId !== payeeId) {
        throw new Error("bill payee mismatch");
      }

      createdBill = createdOrder.bill;
      const mappedQrCodes = await loadSellerPaymentQrCodes(payeeId);

      if (generation !== checkoutGenerationRef.current) return;

      setPaymentQrCodes(mappedQrCodes);
      setDefaultPlatform(
        resolveAvailablePaymentPlatform(mappedQrCodes, currentDefaultPlatform),
      );
      setCheckoutDraft({
        product,
        quantity: checkoutQuantity,
        status: "ready",
        bill: createdBill,
      });
    } catch {
      if (generation !== checkoutGenerationRef.current) return;
      setCheckoutDraft({
        product,
        quantity: checkoutQuantity,
        status: "error",
        bill: createdBill,
        errorMessage: createdBill
          ? "收款码暂不可用，请稍后重试。"
          : "支付账单暂不可用，请稍后再试。",
      });
    } finally {
      checkoutRef.current = false;
      setSubmitting(false);
    }
  }

  async function retryCheckoutQrCodes(draft: CheckoutDraft) {
    const payeeId = draft.bill?.payee?.id;

    if (
      !payeeId ||
      !draft.bill?.updatedAt ||
      draft.product.sellerId !== payeeId
    ) {
      toast.error("下单结果暂不确定，请先到订单列表核对，避免重复下单");
      closeCheckout();
      router.push("/orders?type=spot&view=buyer");
      return;
    }

    if (checkoutRef.current || submittingRef.current) return;
    checkoutRef.current = true;
    const generation = checkoutGenerationRef.current;

    const currentDefaultPlatform = readDefaultPaymentPlatform();

    setDefaultPlatform(currentDefaultPlatform);
    setPaymentQrCodes({});
    setCheckoutDraft({
      ...draft,
      status: "loading",
      errorMessage: undefined,
    });
    setSubmitting(true);

    try {
      const mappedQrCodes = await loadSellerPaymentQrCodes(payeeId);

      if (generation !== checkoutGenerationRef.current) return;

      setPaymentQrCodes(mappedQrCodes);
      setDefaultPlatform(
        resolveAvailablePaymentPlatform(mappedQrCodes, currentDefaultPlatform),
      );
      setCheckoutDraft({
        ...draft,
        status: "ready",
        errorMessage: undefined,
      });
    } catch (error) {
      if (generation !== checkoutGenerationRef.current) return;
      setCheckoutDraft({
        ...draft,
        status: "error",
        errorMessage:
          error instanceof Error
            ? error.message
            : "收款码暂不可用，请稍后重试。",
      });
    } finally {
      checkoutRef.current = false;
      setSubmitting(false);
    }
  }

  async function loadSellerPaymentQrCodes(sellerId: string) {
    const qrCodes = await listPaymentQrCodes({
      ...serviceOptions,
      ownerId: sellerId,
    });

    return qrCodes.reduce<Partial<Record<PaymentPlatform, string>>>(
      (mappedQrCodes, qrCode) => ({
        ...mappedQrCodes,
        [qrCode.channel]: qrCode.content,
      }),
      {},
    );
  }

  async function submitPayment(platform: PaymentPlatform) {
    const draft = checkoutDraft;
    const bill = draft?.bill;
    if (
      draft?.status !== "ready" ||
      !bill?.updatedAt ||
      submittingRef.current ||
      submitted
    ) {
      return;
    }

    const generation = checkoutGenerationRef.current;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const paidBill = await payBill(
        {
          billId: bill.id,
          channel: platform,
          updatedAt: bill.updatedAt,
        },
        serviceOptions,
      );
      if (generation !== checkoutGenerationRef.current) {
        router.refresh();
        return;
      }
      setSubmitted(true);
      setCheckoutDraft((current) =>
        current?.bill?.id === bill.id
          ? {
              ...current,
              status: "submitted",
              bill: paidBill,
            }
          : current,
      );
      toast.success("订单已提交，等待收款确认");
    } catch (error) {
      let latestBill: PaymentBill;

      try {
        latestBill = await getBill(bill.id, serviceOptions);
      } catch {
        if (generation !== checkoutGenerationRef.current) {
          router.refresh();
          return;
        }
        closeCheckout();
        router.refresh();
        toast.error("无法确认支付结果，正在刷新订单，请核对后再操作");
        return;
      }

      if (generation !== checkoutGenerationRef.current) {
        router.refresh();
        return;
      }

      if (latestBill.status === "completed") {
        closeCheckout();
        router.refresh();
        toast.info("订单已完成，正在刷新订单状态");
      } else if (latestBill.status === "submitted") {
        setSubmitted(true);
        setCheckoutDraft((current) =>
          current?.bill?.id === bill.id
            ? { ...current, status: "submitted", bill: latestBill }
            : current,
        );
        toast.info("已读取最新支付状态");
      } else {
        closeCheckout();
        router.refresh();
        toast.error(
          latestBill.status === "unpaid"
            ? "支付确认未完成，账单已刷新，请核对后重试"
            : error instanceof Error
              ? error.message
              : "账单状态已更新，请核对后重试",
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const amount = checkoutDraft
    ? (checkoutDraft.bill?.amountCents ??
      checkoutDraft.product.price * checkoutDraft.quantity)
    : 0;
  const verifyCode = checkoutDraft?.bill?.verifyCode ?? "";

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <section className="flex flex-col gap-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold md:text-2xl">商城</h1>
        </div>
      </section>

      <InputGroup className="h-11 bg-card">
        <InputGroupAddon>
          <InputGroupText>
            <RiSearchLine />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="搜索现货商品"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索商品、规格、店铺或条码"
        />
      </InputGroup>

      {error ? (
        <LoadFailure
          title="现货加载失败"
          description={error}
          onRetry={() => router.refresh()}
        />
      ) : null}

      {!error && filteredProducts.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => {
                void openDetail(product);
              }}
            >
              <Card className="h-full overflow-hidden rounded-lg transition-colors hover:bg-muted/30">
                <ManagedImage
                  src={product.imageUrl}
                  alt={product.title}
                  className="aspect-square"
                />
                <CardHeader className="gap-1 px-3 pt-3">
                  <CardTitle className="line-clamp-2 text-sm leading-snug">
                    {product.title}
                  </CardTitle>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {product.description}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-3 pb-3">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <span className="min-w-0 truncate text-base font-semibold text-primary">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice > product.price ? (
                        <span className="shrink-0 text-xs text-muted-foreground line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RiStore2Line className="size-3.5 shrink-0" />
                    <span className="truncate">{product.storeName}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </section>
      ) : null}

      {!error && filteredProducts.length === 0 && !loadingMore && !hasMore ? (
        <Empty
          icon={<RiShoppingBag3Line className="size-5" />}
          title={query ? "没有匹配的现货" : "暂无在售现货"}
          action={
            query ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuery("")}
              >
                清空搜索
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!error ? (
        <InfiniteListStatus
          hasMore={hasMore}
          loading={loadingMore}
          error={loadMoreError}
          hasItems={totalCount > 0}
          onLoadMore={() => void loadMore()}
          loadingFallback={<SpotGoodsLoadingSkeletons />}
          endMessageClassName="pt-6"
          endMessage={
            query.trim()
              ? `搜索完成，共找到 ${filteredProducts.length} 件商品`
              : `已经到底，共 ${loadedGoods.length} 件商品`
          }
        />
      ) : null}

      <ResponsiveDialog
        open={selectedBrief !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        {selectedBrief ? (
          <ResponsiveDialogContent className="max-h-[88dvh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle>
                {selectedBrief.title}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="sr-only">
                商品详情与购买操作。
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            {detailStatus === "loading" ? (
              <div className="flex min-h-64 items-center justify-center">
                <Spinner className="size-6" />
              </div>
            ) : detailStatus === "error" || !selectedProduct ? (
              <LoadFailure
                className="min-h-56"
                surface="plain"
                title="商品详情加载失败"
                onRetry={() => void openDetail(selectedBrief)}
              />
            ) : (
              <>
                <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-4">
                    <ManagedImage
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.title}
                      className="aspect-video rounded-lg"
                    />
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <p className="text-2xl font-semibold text-primary">
                          {formatPrice(selectedProduct.price)}
                        </p>
                        {selectedProduct.originalPrice >
                        selectedProduct.price ? (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(selectedProduct.originalPrice)}
                          </span>
                        ) : null}
                      </div>
                      <Badge variant="secondary">
                        库存 {selectedProduct.stock}
                      </Badge>
                    </div>
                    <dl className="divide-y rounded-lg bg-secondary/60 px-3">
                      <SellerInfoRow
                        name={selectedProduct.seller}
                        avatarUrl={selectedProduct.sellerAvatarUrl}
                      />
                      <InfoRow label="店铺" value={selectedProduct.storeName} />
                      {selectedProduct.storeAddress ? (
                        <InfoRow
                          label="地址"
                          value={selectedProduct.storeAddress}
                        />
                      ) : null}
                      {selectedProduct.description ? (
                        <InfoRow
                          label="商品规格"
                          value={selectedProduct.description}
                        />
                      ) : null}
                    </dl>
                    {!isOutOfStock ? (
                      <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                        <span className="text-sm font-medium">购买数量</span>
                        <QuantityStepper
                          label="购买数量"
                          value={quantity}
                          max={maxQuantity}
                          onValueChange={setQuantity}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <ResponsiveDialogFooter>
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={isOutOfStock || submitting}
                    onClick={() => {
                      void startCheckout();
                    }}
                  >
                    {submitting ? (
                      <Spinner />
                    ) : (
                      <RiCheckboxCircleLine data-icon="inline-start" />
                    )}
                    {submitting
                      ? "正在创建订单"
                      : isOutOfStock
                        ? "暂时售罄"
                        : `创建订单 · ${formatPrice(selectedProduct.price * quantity)}`}
                  </Button>
                </ResponsiveDialogFooter>
              </>
            )}
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>

      <PaymentDialog
        open={checkoutDraft !== null}
        onOpenChange={(open) => {
          if (!open) closeCheckout();
        }}
        amountCents={amount}
        payeeName={checkoutDraft?.bill?.payee?.name ?? null}
        verifyCode={verifyCode}
        qrCodes={paymentQrCodes}
        defaultPlatform={defaultPlatform}
        status={checkoutDraft?.status ?? "loading"}
        errorMessage={checkoutDraft?.errorMessage}
        submitting={submitting}
        onCancelPayment={() => {
          closeCheckout();
        }}
        onPay={(platform) => {
          void submitPayment(platform);
        }}
        onRetry={() => {
          if (checkoutDraft) {
            void retryCheckoutQrCodes(checkoutDraft);
          }
        }}
      />
    </div>
  );
}

function SpotGoodsLoadingSkeletons() {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      aria-label="正在加载更多商品"
      aria-live="polite"
    >
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} className="overflow-hidden rounded-lg">
          <Skeleton className="aspect-square w-full rounded-none" />
          <CardHeader className="gap-2 px-3 pt-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const PAYMENT_PLATFORM_ORDER: PaymentPlatform[] = ["wechat", "alipay"];

function resolveAvailablePaymentPlatform(
  qrCodes: Partial<Record<PaymentPlatform, string>>,
  preferredPlatform: PaymentPlatform,
) {
  const fallbackPlatform = PAYMENT_PLATFORM_ORDER.find(
    (platform) => qrCodes[platform],
  );

  return qrCodes[preferredPlatform] || !fallbackPlatform
    ? preferredPlatform
    : fallbackPlatform;
}

function mapSpotProductDetail(
  brief: SpotProductBrief,
  detail: SpotGoods,
): SpotProduct {
  return {
    ...brief,
    title: detail.product.title,
    description: detail.product.description,
    price: detail.salePriceCents,
    originalPrice: detail.product.priceCents,
    barcode: detail.product.barcode,
    imageUrl: detail.product.mainImageUrl,
    stock: detail.stock,
    sellerId: detail.sellerId,
    seller: detail.sellerName,
    sellerAvatarUrl: detail.sellerAvatarUrl,
    updatedAt: detail.updatedAt,
  };
}

function SellerInfoRow({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">售卖人</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 font-medium">
        <Avatar className="size-7">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {name.trim().slice(0, 1) || "人"}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{name}</span>
      </dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}

function getSpotGoodsKey(goods: SpotGoodsBrief) {
  return goods.id;
}
