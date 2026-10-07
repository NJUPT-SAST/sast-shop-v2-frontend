"use client";

import { useTransactionAgreement } from "./transaction-agreement-provider";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiAddLine,
  RiBarcodeLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiStoreLine,
} from "@remixicon/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  createSpotGoods,
  withLarkPageJsapi,
  getProductTemplatesByBarcode,
  isLarkScanCancelledError,
  listPaymentQrCodes,
  scanLarkBarcode,
  type DataSource,
  type ProductTemplateMatch,
  type ServiceOptions,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import { Empty } from "@workspace/ui/components/empty";
import { LoadFailure } from "@/components/load-failure";
import { BrandIllustration } from "@/components/brand-illustration";
import { cn } from "@workspace/ui/lib/utils";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { QuantityStepper } from "@workspace/ui/components/quantity-stepper";
import { isJsapiAuthConfig } from "@/lib/jsapi-config";
import { useFeishuUiEnvironment } from "@/hooks/use-feishu-ui-environment";
import {
  canPublishProductTemplate,
  getBarcodeLookupIntent,
  normalizeBarcodeQuery,
  resolveProductTemplateMatches,
  shouldApplyBarcodeResult,
} from "@/lib/product-template-flow";
import { useProfileDialogs } from "./profile-dialogs-provider";
import { StoreCreateDialog } from "./store-create-dialog";

const formSchema = z.object({
  barcode: z
    .string()
    .trim()
    .min(1, "请输入商品条码")
    .regex(/^\d+$/, "商品条码只能包含数字")
    .max(64, "商品条码不能超过 64 位"),
  price: z.coerce
    .number<number>()
    .min(0.01, "售价至少为 0.01 元")
    .max(21474836.47, "售价过高")
    .multipleOf(0.01, "售价最多保留两位小数"),
  stock: z.coerce
    .number<number>()
    .int("库存必须是整数")
    .positive("库存必须大于 0")
    .max(2147483647, "库存过高"),
});

type FormValues = z.infer<typeof formSchema>;
type LookupStatus =
  "idle" | "loading" | "empty" | "choose" | "selected" | "error";

export function PublishSpotForm({
  dataSource,
  connectBaseUrl,
  entry,
  initialBarcode = "",
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
  entry: "manual" | "scan";
  initialBarcode?: string;
}) {
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const { openQrCodeDialog } = useProfileDialogs();
  const { ensureAgreement } = useTransactionAgreement();
  const showFeishuEntry = useFeishuUiEnvironment();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { barcode: initialBarcode, price: 0.01, stock: 1 },
  });
  const barcode = useWatch({ control: form.control, name: "barcode" });
  const activeLookup = useRef(0);
  const scanningRef = useRef(false);
  const scanEntryStartedRef = useRef(false);
  const submittingRef = useRef(false);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [matches, setMatches] = useState<ProductTemplateMatch[]>([]);
  const [selectedMatch, setSelectedMatch] =
    useState<ProductTemplateMatch | null>(null);
  const [pendingMatchId, setPendingMatchId] = useState("");
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [needsQrCode, setNeedsQrCode] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [barcodeEditable, setBarcodeEditable] = useState(
    normalizeBarcodeQuery(initialBarcode).ok,
  );
  const [scanFeedback, setScanFeedback] = useState<{
    message: string;
    failed: boolean;
  } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  function resetLookup() {
    activeLookup.current += 1;
    setLookupStatus("idle");
    setMatches([]);
    setSelectedMatch(null);
    setPendingMatchId("");
    setChoiceOpen(false);
    setSubmitted(false);
    setSubmissionError(null);
  }

  const lookupTemplates = useCallback(
    async (rawBarcode: string) => {
      const normalized = normalizeBarcodeQuery(rawBarcode);
      if (!normalized.ok) {
        form.setError("barcode", { message: normalized.message });
        return;
      }

      form.clearErrors("barcode");
      const lookupId = activeLookup.current + 1;
      activeLookup.current = lookupId;
      setLookupStatus("loading");
      setMatches([]);
      setSelectedMatch(null);

      try {
        const result = await getProductTemplatesByBarcode(
          normalized.barcode,
          serviceOptions,
        );

        if (
          lookupId !== activeLookup.current ||
          !shouldApplyBarcodeResult(
            normalized.barcode,
            form.getValues("barcode"),
          )
        ) {
          return;
        }

        const resolution = resolveProductTemplateMatches(result);
        setMatches(result);

        if (resolution.kind === "empty") {
          setLookupStatus("empty");
          return;
        }

        if (resolution.kind === "selected") {
          setSelectedMatch(resolution.match);
          form.setValue(
            "price",
            Math.max(0.01, resolution.match.productTemplate.priceCents / 100),
          );
          setLookupStatus("selected");
          return;
        }

        setPendingMatchId(
          resolution.matches.find((match) => match.store)?.productTemplate.id ??
            "",
        );
        setLookupStatus("choose");
        setChoiceOpen(true);
      } catch {
        if (lookupId !== activeLookup.current) return;
        setLookupStatus("error");
        toast.error("查询商品模板失败，请稍后再试");
      }
    },
    [form, serviceOptions],
  );

  useEffect(() => {
    const intent = getBarcodeLookupIntent(barcode);

    if (intent.kind === "idle") {
      form.clearErrors("barcode");
      return;
    }

    if (intent.kind === "invalid") {
      form.setError("barcode", { message: intent.message });
      return;
    }

    form.clearErrors("barcode");
    const timeoutId = window.setTimeout(() => {
      void lookupTemplates(intent.barcode);
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [barcode, form, lookupTemplates]);

  useEffect(
    () => () => {
      activeLookup.current += 1;
    },
    [],
  );

  async function scanBarcode() {
    if (scanningRef.current) return;
    if (!window.h5sdk || !window.tt) {
      toast.message(
        showFeishuEntry
          ? "飞书扫码组件尚未就绪，请稍后重试"
          : "请在飞书移动端内扫码",
      );
      return;
    }

    scanningRef.current = true;
    setScanning(true);
    setScanFeedback(null);
    const client = window.tt;
    try {
      const scannedBarcode = await withLarkPageJsapi(
        window.h5sdk,
        async (signingUrl) => {
          const response = await fetch(
            `/api/auth/jsapi-config?url=${encodeURIComponent(signingUrl)}`,
            { cache: "no-store" },
          );
          const body: unknown = await response.json().catch(() => null);
          if (!response.ok || !isJsapiAuthConfig(body)) {
            throw new Error(
              response.status === 401
                ? "登录已失效，请重新打开应用"
                : "扫码鉴权暂不可用，请稍后再试",
            );
          }
          return body;
        },
        () => scanLarkBarcode(client),
      );
      setBarcodeEditable(true);
      const previousBarcode = form.getValues("barcode");
      form.setValue("barcode", scannedBarcode, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      resetLookup();
      if (shouldApplyBarcodeResult(scannedBarcode, previousBarcode)) {
        await lookupTemplates(scannedBarcode);
      }
      toast.success("已识别商品条码");
    } catch (reason) {
      if (isLarkScanCancelledError(reason)) {
        setScanFeedback({
          message: "已取消扫码，可以重试",
          failed: false,
        });
        return;
      }
      const message =
        reason instanceof Error
          ? reason.message === "扫描结果不是有效商品条码，请手动输入"
            ? "未识别到商品条码，请重新扫码"
            : reason.message
          : "扫码失败，请重试";
      setScanFeedback({ message, failed: true });
      toast.error(message);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }

  const startEntryScan = useEffectEvent(() => {
    void scanBarcode();
  });

  useEffect(() => {
    if (
      entry !== "scan" ||
      normalizeBarcodeQuery(initialBarcode).ok ||
      scanEntryStartedRef.current
    )
      return;
    scanEntryStartedRef.current = true;
    startEntryScan();
  }, [entry, initialBarcode]);

  async function submitSpotGoods(values: FormValues) {
    if (submittingRef.current) return;

    if (selectedMatch && !selectedMatch.store) {
      toast.error("请先创建店铺，再重新选择商品");
      return;
    }
    if (!canPublishProductTemplate(selectedMatch)) {
      toast.error(
        selectedMatch ? "模板版本无效，请重新查询" : "请先选择商品模板",
      );
      return;
    }

    if (!(await ensureAgreement()) || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmissionError(null);

    try {
      let qrCodes;
      try {
        qrCodes = await listPaymentQrCodes(serviceOptions);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "收款码状态暂时无法确认，请稍后重试";
        setSubmissionError(message);
        toast.error(message);
        return;
      }

      if (qrCodes.length === 0) {
        setNeedsQrCode(true);
        return;
      }

      try {
        await createSpotGoods(
          {
            productTemplateId: selectedMatch!.productTemplate.id,
            salePriceCents: Math.round(values.price * 100),
            stockTotal: values.stock,
            productTemplateUpdatedAt: selectedMatch!.productTemplate.updatedAt,
          },
          serviceOptions,
        );
        setSubmitted(true);
        toast.success("已提交上架");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "上架失败，请稍后再试";
        setSubmissionError(message);
        toast.error(message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const createTemplateHref = `/group/templates?create=1&barcode=${encodeURIComponent(
    barcode.trim(),
  )}`;
  const createStoreReturnTo = buildCreateStoreReturnTo(barcode);
  const showEntryForm = barcodeEditable;

  if (submitted) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-6 py-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
        <h1 className="text-xl font-semibold md:text-2xl">上架现货</h1>
        <Empty
          className="flex-1"
          icon={<RiCheckboxCircleLine className="size-5 text-primary" />}
          title={`已上架${selectedMatch?.productTemplate.title ?? "商品"}`}
          action={
            <Button
              type="button"
              onClick={() => {
                form.reset({ barcode: "", price: 0.01, stock: 1 });
                resetLookup();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <RiAddLine data-icon="inline-start" />
              继续上架
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 py-6">
      <h1 className="min-w-0 text-xl font-semibold md:text-2xl">上架现货</h1>

      <section
        className={cn(
          "flex min-w-0 flex-col gap-5",
          (lookupStatus === "empty" || lookupStatus === "error") && "flex-1",
        )}
      >
        <h2 className="text-sm font-medium text-muted-foreground">
          第 1 步 · 识别商品
        </h2>
        {!showEntryForm ? (
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <RiBarcodeLine className="size-5 text-primary" />
              <p className="font-medium">扫描商品条码</p>
            </div>
            {scanFeedback ? (
              <p
                role={scanFeedback.failed ? "alert" : "status"}
                className={
                  scanFeedback.failed
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                {scanFeedback.message}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                扫描商品包装上的条码，识别后可修改编号
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={scanning}
                onClick={() => void scanBarcode()}
              >
                {scanning ? (
                  <Spinner className="size-4" />
                ) : (
                  <RiBarcodeLine data-icon="inline-start" />
                )}
                {scanning ? "正在扫码" : scanFeedback ? "再次扫码" : "开始扫码"}
              </Button>
            </div>
          </div>
        ) : null}
        {showEntryForm ? (
          <Controller
            name="barcode"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>商品条码</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <RiBarcodeLine />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    value={field.value}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="输入商品条码编号"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid
                        ? `publish-${field.name}-error`
                        : undefined
                    }
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event);
                      form.clearErrors("barcode");
                      resetLookup();
                    }}
                    ref={field.ref}
                  />
                </InputGroup>
                <FieldError
                  id={`publish-${field.name}-error`}
                  errors={[fieldState.error]}
                />
              </Field>
            )}
          />
        ) : null}

        {lookupStatus === "loading" ? (
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            正在匹配商品
          </div>
        ) : null}

        {lookupStatus === "empty" ? (
          <Empty
            className="flex-1 [@media(max-height:640px)]:py-4"
            illustration={
              <BrandIllustration
                name="barcode-empty"
                size={112}
                className="[@media(max-height:640px)]:size-20"
              />
            }
            title="未找到商品模板"
            description="该条码还没有对应模板，创建后即可继续上架"
            action={
              <Button asChild size="touch">
                <Link href={createTemplateHref}>创建商品模板</Link>
              </Button>
            }
          />
        ) : null}

        {lookupStatus === "error" ? (
          <LoadFailure
            className="flex-1"
            title="商品匹配失败"
            description="暂时无法获取商品信息，请稍后重试"
            retryLabel="重试匹配"
            onRetry={() => void lookupTemplates(barcode)}
          />
        ) : null}

        {lookupStatus === "choose" && matches.length > 1 && !selectedMatch ? (
          <Item variant="outline">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <RiStoreLine />
            </span>
            <ItemContent>
              <ItemTitle>发现 {matches.length} 个匹配商品</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChoiceOpen(true)}
              >
                选择
              </Button>
            </ItemActions>
          </Item>
        ) : null}

        {selectedMatch ? (
          <SelectedTemplateItem
            match={selectedMatch}
            onCreateStore={() => setStoreDialogOpen(true)}
          />
        ) : null}
      </section>

      {selectedMatch?.store ? (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            第 2 步 · 填写上架信息
          </h2>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Controller
              name="price"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>售卖单价</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>¥</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      value={field.value}
                      type="number"
                      min={0.01}
                      step={0.01}
                      inputMode="decimal"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid
                          ? `publish-${field.name}-error`
                          : undefined
                      }
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      ref={field.ref}
                    />
                  </InputGroup>
                  <FieldError
                    id={`publish-${field.name}-error`}
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
            <Controller
              name="stock"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>初始库存</FieldLabel>
                  <QuantityStepper
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid
                        ? `publish-${field.name}-error`
                        : undefined
                    }
                    className="w-full"
                    valueClassName="min-w-0 flex-1"
                    label="初始库存"
                    value={Number(field.value)}
                    max={2147483647}
                    onValueChange={field.onChange}
                  />
                  <FieldError
                    id={`publish-${field.name}-error`}
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
          </FieldGroup>

          <Alert>
            <RiErrorWarningLine />
            <AlertTitle>上架前确认收款码</AlertTitle>
            <AlertDescription>
              请确认已上传微信或支付宝收款码，提交时会再次检查。
            </AlertDescription>
            <AlertAction>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openQrCodeDialog}
              >
                查看收款码
              </Button>
            </AlertAction>
          </Alert>

          {submissionError ? (
            <Alert variant="destructive">
              <RiErrorWarningLine />
              <AlertTitle>上架失败</AlertTitle>
              <AlertDescription>{submissionError}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="h-11"
            disabled={submitting || !canPublishProductTemplate(selectedMatch)}
            onClick={() => void form.handleSubmit(submitSpotGoods)()}
          >
            <RiCheckboxCircleLine />
            {submitting ? "提交中" : "上架商品"}
          </Button>
        </>
      ) : null}

      <StoreChoiceDrawer
        open={choiceOpen}
        matches={matches}
        value={pendingMatchId}
        onValueChange={setPendingMatchId}
        onOpenChange={setChoiceOpen}
        onCreateStore={() => {
          setChoiceOpen(false);
          window.setTimeout(() => setStoreDialogOpen(true), 240);
        }}
        onConfirm={() => {
          const next = matches.find(
            (match) => match.productTemplate.id === pendingMatchId,
          );
          if (!next) return;
          setSelectedMatch(next);
          form.setValue(
            "price",
            Math.max(0.01, next.productTemplate.priceCents / 100),
          );
          setLookupStatus("selected");
          setChoiceOpen(false);
        }}
      />

      <StoreCreateDialog
        open={storeDialogOpen}
        onOpenChange={setStoreDialogOpen}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        returnTo={createStoreReturnTo}
      />

      <Drawer open={needsQrCode} onOpenChange={setNeedsQrCode}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>请先上传收款码</DrawerTitle>
            <DrawerDescription>
              上架前需配置微信或支付宝收款码
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNeedsQrCode(false)}
            >
              稍后处理
            </Button>
            <Button
              type="button"
              onClick={() => {
                setNeedsQrCode(false);
                window.setTimeout(openQrCodeDialog, 240);
              }}
            >
              前往上传
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SelectedTemplateItem({
  match,
  onCreateStore,
}: {
  match: ProductTemplateMatch;
  onCreateStore: () => void;
}) {
  const template = match.productTemplate;

  return (
    <Item
      variant="outline"
      className="min-w-0 items-start border-primary/40 bg-primary/5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <RiStoreLine />
      </span>
      <ItemContent className="min-w-0">
        <ItemTitle className="min-w-0 truncate leading-5">
          {template.title}
        </ItemTitle>
        <ItemDescription className="truncate">
          {match.store
            ? `${match.store.name} · 参考价 ${formatPrice(template.priceCents)}`
            : "未找到店铺信息"}
        </ItemDescription>
      </ItemContent>
      {!match.store ? (
        <ItemActions>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCreateStore}
          >
            创建店铺
          </Button>
        </ItemActions>
      ) : null}
    </Item>
  );
}

function StoreChoiceDrawer({
  open,
  matches,
  value,
  onValueChange,
  onOpenChange,
  onConfirm,
  onCreateStore,
}: {
  open: boolean;
  matches: ProductTemplateMatch[];
  value: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCreateStore: () => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>选择匹配商品</DrawerTitle>
          <DrawerDescription className="sr-only">
            选择本次上架的商品
          </DrawerDescription>
        </DrawerHeader>
        <RadioGroup
          value={value}
          onValueChange={onValueChange}
          className="app-scrollbar min-h-0 overflow-y-auto px-4"
        >
          {matches.map((match) =>
            match.store ? (
              <label
                key={match.productTemplate.id}
                className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
              >
                <RadioGroupItem
                  value={match.productTemplate.id}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {match.productTemplate.title}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {match.store.name} ·{" "}
                    {formatPrice(match.productTemplate.priceCents)}
                  </span>
                  {match.store.address ? (
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {match.store.address}
                    </span>
                  ) : null}
                </span>
              </label>
            ) : (
              <Item key={match.productTemplate.id} variant="outline">
                <ItemContent>
                  <ItemTitle>{match.productTemplate.title}</ItemTitle>
                  <ItemDescription>未找到店铺信息</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCreateStore}
                  >
                    创建店铺
                  </Button>
                </ItemActions>
              </Item>
            ),
          )}
        </RadioGroup>
        <DrawerFooter>
          <Button type="button" size="lg" disabled={!value} onClick={onConfirm}>
            确认商品
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function buildCreateStoreReturnTo(barcode: string): string {
  return `/group/templates?create=1&barcode=${encodeURIComponent(
    barcode.trim(),
  )}`;
}
