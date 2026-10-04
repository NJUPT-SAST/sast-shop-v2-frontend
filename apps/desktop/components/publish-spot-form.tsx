"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiBarcodeLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiStoreLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  createSpotGoods,
  getProductTemplatesByBarcode,
  listPaymentQrCodes,
  type DataSource,
  type ProductTemplateMatch,
  type ServiceOptions,
} from "@sast-shop/api";
import { formatPrice, parseYuanToCents } from "@sast-shop/domain";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Empty } from "@workspace/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import {
  Item,
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
  resolveProductTemplateMatches,
  shouldApplyBarcodeResult,
} from "@/lib/product-template-flow";
import { StoreCreateDialog } from "@/components/store-create-dialog";
import { useTransactionAgreement } from "./transaction-agreement-provider";

type LookupStatus =
  "idle" | "loading" | "empty" | "choose" | "selected" | "error";

export function PublishSpotForm({
  dataSource,
  connectBaseUrl,
}: {
  dataSource: DataSource;
  connectBaseUrl: string;
}) {
  const { ensureAgreement } = useTransactionAgreement();
  const serviceOptions: ServiceOptions = useMemo(
    () => ({ dataSource, connectBaseUrl }),
    [connectBaseUrl, dataSource],
  );
  const activeLookup = useRef(0);
  const submittingRef = useRef(false);
  const [barcode, setBarcode] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [matches, setMatches] = useState<ProductTemplateMatch[]>([]);
  const [selectedMatch, setSelectedMatch] =
    useState<ProductTemplateMatch | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [pendingMatchId, setPendingMatchId] = useState("");
  const [price, setPrice] = useState("0.01");
  const [stock, setStock] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [needsQrCode, setNeedsQrCode] = useState(false);

  const barcodeIntent = useMemo(
    () => getBarcodeLookupIntent(barcode),
    [barcode],
  );
  const barcodeError =
    barcodeIntent.kind === "invalid" ? barcodeIntent.message : null;
  const createStoreReturnTo = buildCreateStoreReturnTo(barcode);

  const lookupTemplates = useCallback(
    async (requestedBarcode: string) => {
      const lookupId = activeLookup.current + 1;
      activeLookup.current = lookupId;
      setLookupStatus("loading");
      setSelectedMatch(null);
      setMatches([]);
      setFormError(null);

      try {
        const result = await getProductTemplatesByBarcode(
          requestedBarcode,
          serviceOptions,
        );
        if (
          lookupId !== activeLookup.current ||
          !shouldApplyBarcodeResult(requestedBarcode, barcode)
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
          setPrice(
            Math.max(
              0.01,
              resolution.match.productTemplate.priceCents / 100,
            ).toFixed(2),
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
      }
    },
    [barcode, serviceOptions],
  );

  useEffect(() => {
    if (barcodeIntent.kind !== "lookup") return;
    const timeoutId = window.setTimeout(() => {
      void lookupTemplates(barcodeIntent.barcode);
    }, 320);
    return () => window.clearTimeout(timeoutId);
  }, [barcodeIntent, lookupTemplates]);

  useEffect(
    () => () => {
      activeLookup.current += 1;
    },
    [],
  );

  function selectMatch(match: ProductTemplateMatch) {
    setSelectedMatch(match);
    setPrice(Math.max(0.01, match.productTemplate.priceCents / 100).toFixed(2));
    setLookupStatus("selected");
    setChoiceOpen(false);
  }

  function resetForNext() {
    activeLookup.current += 1;
    setBarcode("");
    setSelectedMatch(null);
    setMatches([]);
    setLookupStatus("idle");
    setPrice("0.01");
    setStock("1");
    setFormError(null);
    setNeedsQrCode(false);
    setSubmittedTitle(null);
  }

  async function submit() {
    if (submittingRef.current || !selectedMatch) return;
    const priceCents = parseYuanToCents(price);
    const stockValue = Number(stock);
    if (priceCents === null || priceCents < 1) {
      setFormError("售卖单价应为不超过 21474836.47 元的两位小数");
      return;
    }
    if (
      !Number.isInteger(stockValue) ||
      stockValue < 1 ||
      stockValue > 2_147_483_647
    ) {
      setFormError("初始库存必须是 1 至 2147483647 的整数");
      return;
    }
    if (!selectedMatch.store) {
      setFormError("请先创建店铺，再重新选择商品");
      return;
    }
    if (!canPublishProductTemplate(selectedMatch)) {
      setFormError("商品模板版本无效，请重新输入条码");
      return;
    }

    const match = selectedMatch;
    if (!(await ensureAgreement())) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    setNeedsQrCode(false);
    try {
      let qrCodes;
      try {
        qrCodes = await listPaymentQrCodes(serviceOptions);
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "收款码状态暂时无法确认，请稍后重试",
        );
        return;
      }

      if (qrCodes.length === 0) {
        setNeedsQrCode(true);
        return;
      }

      try {
        await createSpotGoods(
          {
            productTemplateId: match.productTemplate.id,
            salePriceCents: priceCents,
            stockTotal: stockValue,
            productTemplateUpdatedAt: match.productTemplate.updatedAt,
          },
          serviceOptions,
        );
        setSubmittedTitle(match.productTemplate.title);
        toast.success("现货已上架");
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : "上架失败，请稍后重试",
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (submittedTitle) {
    return (
      <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
        <h1 className="text-3xl font-semibold tracking-tight">上架现货</h1>
        <Empty
          icon={<RiCheckboxCircleLine className="size-5 text-primary" />}
          title={`${submittedTitle}已上架`}
          action={
            <Button type="button" onClick={resetForNext}>
              <RiAddLine data-icon="inline-start" />
              继续上架
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">上架现货</h1>
        <Button asChild variant="outline">
          <Link href="/group">
            <RiArrowLeftLine data-icon="inline-start" />
            返回团购工作台
          </Link>
        </Button>
      </section>

      <Card className="max-w-3xl">
        <CardContent className="grid gap-6 p-6">
          <Field data-invalid={Boolean(barcodeError)}>
            <FieldLabel htmlFor="desktop-spot-barcode">商品条码</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiBarcodeLine />
              </InputGroupAddon>
              <InputGroupInput
                id="desktop-spot-barcode"
                value={barcode}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="输入商品条码编号"
                aria-invalid={Boolean(barcodeError)}
                onChange={(event) => {
                  activeLookup.current += 1;
                  setBarcode(event.target.value);
                  setSelectedMatch(null);
                  setMatches([]);
                  setFormError(null);
                  setNeedsQrCode(false);
                }}
              />
            </InputGroup>
            {barcodeError ? <FieldError>{barcodeError}</FieldError> : null}
          </Field>

          {lookupStatus === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              正在匹配商品
            </div>
          ) : null}

          {lookupStatus === "empty" ? (
            <Item variant="outline" asChild>
              <Link
                href={`/group/templates?create=1&barcode=${encodeURIComponent(barcode.trim())}`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                  <RiAddLine />
                </span>
                <ItemContent>
                  <ItemTitle>未找到商品模板</ItemTitle>
                  <ItemDescription>创建模板后即可继续上架</ItemDescription>
                </ItemContent>
              </Link>
            </Item>
          ) : null}

          {lookupStatus === "error" ? (
            <Alert variant="destructive">
              <RiErrorWarningLine />
              <AlertTitle>商品匹配失败</AlertTitle>
              <AlertDescription>请检查网络后重试。</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void lookupTemplates(barcode.trim())}
                >
                  重试
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {lookupStatus === "choose" && !selectedMatch ? (
            <Item variant="outline">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                <RiStoreLine />
              </span>
              <ItemContent>
                <ItemTitle>发现 {matches.length} 个匹配商品</ItemTitle>
              </ItemContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChoiceOpen(true)}
              >
                选择
              </Button>
            </Item>
          ) : null}

          {selectedMatch ? (
            <>
              <Item
                variant="outline"
                className="border-primary/40 bg-primary/5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <RiStoreLine />
                </span>
                <ItemContent>
                  <ItemTitle>{selectedMatch.productTemplate.title}</ItemTitle>
                  <ItemDescription>
                    {selectedMatch.store
                      ? `${selectedMatch.store.name} · 参考价 ${formatPrice(selectedMatch.productTemplate.priceCents)}`
                      : "未找到店铺信息"}
                  </ItemDescription>
                </ItemContent>
                {!selectedMatch.store ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStoreDialogOpen(true)}
                  >
                    创建店铺
                  </Button>
                ) : null}
              </Item>

              {selectedMatch.store ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="desktop-spot-price">
                      售卖单价
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>¥</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="desktop-spot-price"
                        type="number"
                        min="0.01"
                        max="21474836.47"
                        step="0.01"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="desktop-spot-stock">
                      初始库存
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="desktop-spot-stock"
                        type="number"
                        min="1"
                        max="2147483647"
                        step="1"
                        value={stock}
                        onChange={(event) => setStock(event.target.value)}
                      />
                    </InputGroup>
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}

          {formError ? (
            <Alert variant="destructive">
              <RiErrorWarningLine />
              <AlertTitle>无法上架</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {selectedMatch?.store ? (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={
                  submitting || !canPublishProductTemplate(selectedMatch)
                }
                onClick={() => void submit()}
              >
                {submitting ? <Spinner /> : <RiCheckboxCircleLine />}
                {submitting ? "提交中" : "上架商品"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择匹配商品</DialogTitle>
            <DialogDescription className="sr-only">
              选择本次上架的商品
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={pendingMatchId} onValueChange={setPendingMatchId}>
            {matches.map((match) =>
              match.store ? (
                <label
                  key={match.productTemplate.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                >
                  <RadioGroupItem
                    value={match.productTemplate.id}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {match.productTemplate.title}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {match.store.name} ·{" "}
                      {formatPrice(match.productTemplate.priceCents)}
                    </span>
                  </span>
                </label>
              ) : (
                <Item key={match.productTemplate.id} variant="outline">
                  <ItemContent>
                    <ItemTitle>{match.productTemplate.title}</ItemTitle>
                    <ItemDescription>未找到店铺信息</ItemDescription>
                  </ItemContent>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setChoiceOpen(false);
                      window.setTimeout(() => setStoreDialogOpen(true), 200);
                    }}
                  >
                    创建店铺
                  </Button>
                </Item>
              ),
            )}
          </RadioGroup>
          <DialogFooter>
            <Button
              type="button"
              disabled={!pendingMatchId}
              onClick={() => {
                const next = matches.find(
                  (match) => match.productTemplate.id === pendingMatchId,
                );
                if (next) selectMatch(next);
              }}
            >
              确认商品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StoreCreateDialog
        open={storeDialogOpen}
        onOpenChange={setStoreDialogOpen}
        dataSource={dataSource}
        connectBaseUrl={connectBaseUrl}
        returnTo={createStoreReturnTo}
      />

      <Dialog open={needsQrCode} onOpenChange={setNeedsQrCode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>请先上传收款码</DialogTitle>
            <DialogDescription>
              上架商品前需准备微信或支付宝收款码，用于买家付款。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNeedsQrCode(false)}>
              稍后处理
            </Button>
            <Button asChild>
              <Link href="/profile">前往上传</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildCreateStoreReturnTo(barcode: string): string {
  return `/group/templates?create=1&barcode=${encodeURIComponent(
    barcode.trim(),
  )}`;
}
