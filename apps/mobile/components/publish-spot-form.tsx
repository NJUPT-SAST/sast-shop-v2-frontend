"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  RiAddLine,
  RiArrowRightSLine,
  RiBarcodeLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiQrScan2Line,
  RiStoreLine,
  RiSubtractLine,
} from "@remixicon/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  createSpotGoods,
  configureLarkJsapi,
  getProductTemplatesByBarcode,
  isLarkScanCancelledError,
  listPaymentQrCodes,
  scanLarkBarcode,
  type DataSource,
  type JSAPIAuthConfig,
  type ProductTemplateMatch,
  type ServiceOptions,
} from "@sast-shop/api";
import { formatPrice } from "@sast-shop/domain";
import { Badge } from "@workspace/ui/components/badge";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@workspace/ui/components/button-group";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
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
import {
  canPublishProductTemplate,
  getBarcodeLookupIntent,
  normalizeBarcodeQuery,
  resolveProductTemplateMatches,
  shouldApplyBarcodeResult,
} from "@/lib/product-template-flow";
import { useProfileDialogs } from "./profile-dialogs-provider";

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
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
}) {
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const { openQrCodeDialog } = useProfileDialogs();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { barcode: "", price: 0.01, stock: 1 },
  });
  const barcode = useWatch({ control: form.control, name: "barcode" });
  const activeLookup = useRef(0);
  const scanningRef = useRef(false);
  const submittingRef = useRef(false);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [matches, setMatches] = useState<ProductTemplateMatch[]>([]);
  const [selectedMatch, setSelectedMatch] =
    useState<ProductTemplateMatch | null>(null);
  const [pendingMatchId, setPendingMatchId] = useState("");
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
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

        setPendingMatchId(resolution.matches[0]?.productTemplate.id ?? "");
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
      toast.message("请在飞书移动端内扫码，当前环境可手动输入条码");
      return;
    }

    scanningRef.current = true;
    setScanning(true);
    try {
      const signingUrl = window.location.href.split("#", 1)[0] ?? "";
      const response = await fetch(
        `/api/auth/jsapi-config?url=${encodeURIComponent(signingUrl)}`,
        { cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isJSAPIAuthConfig(body)) {
        throw new Error(
          response.status === 401
            ? "登录已失效，请重新打开应用"
            : "扫码鉴权暂不可用，请稍后再试",
        );
      }

      await configureLarkJsapi(window.h5sdk, body);
      const scannedBarcode = await scanLarkBarcode(window.tt);
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
      if (isLarkScanCancelledError(reason)) return;
      toast.error(
        reason instanceof Error ? reason.message : "扫码失败，请手动输入条码",
      );
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }

  async function submitSpotGoods(values: FormValues) {
    if (submittingRef.current) return;

    if (!canPublishProductTemplate(selectedMatch)) {
      toast.error(
        selectedMatch ? "模板版本无效，请重新查询" : "请先选择商品模板",
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmissionError(null);

    try {
      const qrCodes = await listPaymentQrCodes(serviceOptions);

      if (qrCodes.length === 0) {
        toast.error("请先配置收款码，再上架现货");
        openQrCodeDialog();
        return;
      }

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
    } catch {
      const message = "上架失败，请稍后再试";
      setSubmissionError(message);
      toast.error(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const createTemplateHref = `/group/templates?create=1&barcode=${encodeURIComponent(
    barcode.trim(),
  )}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 py-6">
      <section className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-xl font-semibold md:text-2xl">上架现货</h1>
        {submitted ? <Badge>已提交</Badge> : null}
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        <Controller
          name="barcode"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>商品条码编号</FieldLabel>
              <InputGroup className="h-11">
                <InputGroupAddon>
                  <RiBarcodeLine />
                </InputGroupAddon>
                <InputGroupInput
                  id={field.name}
                  name={field.name}
                  value={field.value}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="输入或扫描条码"
                  aria-invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    field.onChange(event);
                    form.clearErrors("barcode");
                    resetLookup();
                  }}
                  ref={field.ref}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-touch"
                    aria-label="扫描条码"
                    title="扫描条码"
                    disabled={scanning}
                    onClick={() => void scanBarcode()}
                  >
                    <RiQrScan2Line />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        {lookupStatus === "loading" ? (
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            正在匹配商品
          </div>
        ) : null}

        {lookupStatus === "empty" ? (
          <TemplateActionItem
            title="新建商品模板"
            icon={<RiAddLine />}
            href={createTemplateHref}
          />
        ) : null}

        {lookupStatus === "error" ? (
          <Alert variant="destructive">
            <RiErrorWarningLine />
            <AlertTitle>商品匹配失败</AlertTitle>
            <AlertDescription>请检查网络，或修改条码后重试。</AlertDescription>
            <AlertAction>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void lookupTemplates(barcode)}
              >
                重试
              </Button>
            </AlertAction>
          </Alert>
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

        {selectedMatch ? <SelectedTemplateItem match={selectedMatch} /> : null}
      </section>

      {selectedMatch ? (
        <>
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
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      ref={field.ref}
                    />
                  </InputGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="stock"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>初始库存</FieldLabel>
                  <ButtonGroup
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-label="调整初始库存"
                    className="w-full"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-touch"
                      aria-label="减少库存"
                      disabled={Number(field.value) <= 1}
                      onClick={() =>
                        field.onChange(Math.max(1, Number(field.value) - 1))
                      }
                    >
                      <RiSubtractLine />
                    </Button>
                    <ButtonGroupText className="min-w-0 flex-1 justify-center">
                      {field.value}
                    </ButtonGroupText>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-touch"
                      aria-label="增加库存"
                      onClick={() => field.onChange(Number(field.value) + 1)}
                    >
                      <RiAddLine />
                    </Button>
                  </ButtonGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>

          <Button
            type="button"
            size="lg"
            className="h-11"
            disabled={
              submitted ||
              submitting ||
              !canPublishProductTemplate(selectedMatch)
            }
            onClick={() => void form.handleSubmit(submitSpotGoods)()}
          >
            <RiCheckboxCircleLine />
            {submitting ? "提交中" : submitted ? "已提交上架" : "上架商品"}
          </Button>
          {submissionError ? (
            <Alert variant="destructive">
              <RiErrorWarningLine />
              <AlertTitle>上架失败</AlertTitle>
              <AlertDescription>{submissionError}</AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : null}

      <StoreChoiceDrawer
        open={choiceOpen}
        matches={matches}
        value={pendingMatchId}
        onValueChange={setPendingMatchId}
        onOpenChange={setChoiceOpen}
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
    </div>
  );
}

function SelectedTemplateItem({ match }: { match: ProductTemplateMatch }) {
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
          {storeLabel(match)} · 参考价 {formatPrice(template.priceCents)}
        </ItemDescription>
      </ItemContent>
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
}: {
  open: boolean;
  matches: ProductTemplateMatch[];
  value: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
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
          {matches.map((match) => (
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
                  {storeLabel(match)}
                </span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">
                  {match.productTemplate.title} ·{" "}
                  {formatPrice(match.productTemplate.priceCents)}
                </span>
                {match.store?.address ? (
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {match.store.address}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </RadioGroup>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button type="button" size="lg" disabled={!value} onClick={onConfirm}>
            确认商品
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function TemplateActionItem({
  title,
  icon,
  href,
}: {
  title: string;
  icon: ReactNode;
  href: string;
}) {
  return (
    <Item variant="outline" asChild>
      <Link href={href}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          {icon}
        </span>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <RiArrowRightSLine />
        </ItemActions>
      </Link>
    </Item>
  );
}

function storeLabel(match: ProductTemplateMatch): string {
  return match.store?.name ?? `店铺 ${match.productTemplate.storeId}`;
}

function isJSAPIAuthConfig(value: unknown): value is JSAPIAuthConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Partial<JSAPIAuthConfig>;
  return (
    typeof config.appId === "string" &&
    Boolean(config.appId) &&
    typeof config.timestamp === "string" &&
    Boolean(config.timestamp) &&
    typeof config.nonceStr === "string" &&
    Boolean(config.nonceStr) &&
    typeof config.signature === "string" &&
    Boolean(config.signature)
  );
}
