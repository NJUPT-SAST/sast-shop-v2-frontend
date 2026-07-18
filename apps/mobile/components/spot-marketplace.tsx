"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiSearchLine,
  RiShoppingBag3Line,
  RiStore2Line,
  RiSubtractLine,
} from "@remixicon/react";
import {
  createSpotOrders,
  listPaymentQrCodes,
  payBill,
  type DataSource,
  type PaymentBill,
  type ServiceOptions,
  type SpotGoods,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Empty } from "@workspace/ui/components/empty";
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
import { toast } from "sonner";

import {
  readDefaultPaymentPlatform,
  type PaymentPlatform,
} from "@/lib/payment-preferences";
import { ManagedImage } from "./managed-image";
import { PaymentDialog, type PaymentDialogStatus } from "./payment-dialog";

type SpotProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  stock: number | null;
  sellerId: string | null;
  seller: string;
  barcode: string;
  imageUrl: string;
  updatedAt: string | null;
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
  products,
  error,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  products: SpotGoods[];
  error: string | null;
}) {
  const serviceOptions: ServiceOptions = { dataSource, connectBaseUrl };
  const spotGoods = useMemo(
    () =>
      products.map((goods) => ({
        id: goods.id,
        title: goods.product.title,
        description: goods.product.description,
        price: goods.salePriceCents,
        originalPrice: goods.product.priceCents,
        stock: goods.stock,
        sellerId: goods.sellerId,
        seller: goods.sellerName ?? "发布者",
        barcode: goods.product.barcode,
        imageUrl: goods.product.mainImageUrl,
        updatedAt: goods.updatedAt,
      })),
    [products],
  );
  const [selectedProduct, setSelectedProduct] = useState<SpotProduct | null>(
    null,
  );
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
  const availableProducts = useMemo(
    () =>
      spotGoods.filter(
        (product) => product.stock === null || product.stock > 0,
      ),
    [spotGoods],
  );
  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();

    if (!keyword) {
      return availableProducts;
    }

    return availableProducts.filter((product) =>
      [
        product.title,
        product.description,
        product.seller,
        product.barcode,
      ].some((value) => value.toLocaleLowerCase().includes(keyword)),
    );
  }, [availableProducts, query]);

  const maxQuantity = selectedProduct?.stock ?? 99;
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
    setSelectedProduct(null);
    setQuantity(1);
  }

  async function startCheckout() {
    if (!selectedProduct) return;

    await beginCheckout(selectedProduct, quantity);
  }

  async function beginCheckout(product: SpotProduct, checkoutQuantity: number) {
    const currentDefaultPlatform = readDefaultPaymentPlatform();

    setDefaultPlatform(currentDefaultPlatform);
    setPaymentQrCodes({});
    setCheckoutDraft({
      product,
      quantity: checkoutQuantity,
      status: "loading",
      bill: null,
    });
    setSelectedProduct(null);
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

      if (product.sellerId && product.sellerId !== payeeId) {
        throw new Error("bill payee mismatch");
      }

      createdBill = createdOrder.bill;
      const mappedQrCodes = await loadSellerPaymentQrCodes(payeeId);

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
      setSubmitting(false);
    }
  }

  async function retryCheckoutQrCodes(draft: CheckoutDraft) {
    const payeeId = draft.bill?.payee?.id;

    if (
      !payeeId ||
      !draft.bill?.updatedAt ||
      (draft.product.sellerId && draft.product.sellerId !== payeeId)
    ) {
      await beginCheckout(draft.product, draft.quantity);
      return;
    }

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

      setPaymentQrCodes(mappedQrCodes);
      setDefaultPlatform(
        resolveAvailablePaymentPlatform(mappedQrCodes, currentDefaultPlatform),
      );
      setCheckoutDraft({
        ...draft,
        status: "ready",
        errorMessage: undefined,
      });
    } catch {
      setCheckoutDraft({
        ...draft,
        status: "error",
        errorMessage: "收款码暂不可用，请稍后重试。",
      });
    } finally {
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
    if (!checkoutDraft?.bill?.updatedAt || submittingRef.current || submitted) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const paidBill = await payBill(
        {
          billId: checkoutDraft.bill.id,
          channel: platform,
          updatedAt: checkoutDraft.bill.updatedAt,
        },
        serviceOptions,
      );
      setSubmitted(true);
      setCheckoutDraft((current) =>
        current
          ? {
              ...current,
              status: "submitted",
              bill: paidBill,
            }
          : current,
      );
      toast.success("订单已提交，等待收款确认");
    } catch {
      toast.error("支付提交失败，请稍后再试");
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
          <h1 className="text-xl font-semibold md:text-2xl">现货商城</h1>
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
          placeholder="搜索商品、规格、卖家或条码"
        />
      </InputGroup>

      {error ? (
        <Alert variant="destructive">
          <RiErrorWarningLine />
          <AlertTitle>现货加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!error && filteredProducts.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => {
                setSelectedProduct(product);
                setQuantity(1);
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
                    <span className="min-w-0 truncate text-base font-semibold text-primary">
                      {formatPrice(product.price)}
                    </span>
                    <Badge variant="neutral" className="shrink-0">
                      {product.stock === null
                        ? "库存待确认"
                        : `库存 ${product.stock}`}
                    </Badge>
                  </div>
                  {product.originalPrice > product.price ? (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RiStore2Line className="size-3.5 shrink-0" />
                    <span className="truncate">{product.seller}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </section>
      ) : null}

      {!error && filteredProducts.length === 0 ? (
        <Empty
          icon={<RiShoppingBag3Line className="size-5" />}
          title={query ? "没有匹配的现货" : "暂无在售现货"}
          description={
            query
              ? "换个关键词，或清空搜索查看全部商品。"
              : "商品上架后会显示在这里。"
          }
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

      <ResponsiveDialog
        open={selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        {selectedProduct ? (
          <ResponsiveDialogContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ResponsiveDialogHeader className="px-0 text-left">
              <ResponsiveDialogTitle>
                {selectedProduct.title}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                确认商品与数量后创建订单并进入支付。
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <div className="flex flex-col gap-4">
              <ManagedImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.title}
                className="aspect-video rounded-lg"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-primary">
                    {formatPrice(selectedProduct.price)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    售卖人：{selectedProduct.seller}
                  </p>
                </div>
                <Badge variant="secondary">
                  {selectedProduct.stock === null
                    ? "库存以发布者确认为准"
                    : `库存 ${selectedProduct.stock}`}
                </Badge>
              </div>
              <dl className="divide-y rounded-lg bg-secondary/60 px-3">
                <InfoRow label="商品规格" value={selectedProduct.description} />
                <InfoRow label="条码编号" value={selectedProduct.barcode} />
              </dl>
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                <span className="text-sm font-medium">购买数量</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-touch"
                    aria-label="减少购买数量"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((value) => value - 1)}
                  >
                    <RiSubtractLine />
                  </Button>
                  <span className="min-w-6 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-touch"
                    aria-label="增加购买数量"
                    disabled={quantity >= maxQuantity}
                    onClick={() => setQuantity((value) => value + 1)}
                  >
                    <RiAddLine />
                  </Button>
                </div>
              </div>
            </div>

            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={closeDetail}>
                取消
              </Button>
              <Button
                type="button"
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
                  : `创建订单 · ${formatPrice(selectedProduct.price * quantity)}`}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        ) : null}
      </ResponsiveDialog>

      <PaymentDialog
        open={checkoutDraft !== null}
        onOpenChange={(open) => {
          if (!open) setCheckoutDraft(null);
        }}
        amountCents={amount}
        verifyCode={verifyCode}
        qrCodes={paymentQrCodes}
        defaultPlatform={defaultPlatform}
        status={checkoutDraft?.status ?? "loading"}
        errorMessage={checkoutDraft?.errorMessage}
        submitting={submitting}
        onCancelPayment={() => {
          setCheckoutDraft(null);
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
