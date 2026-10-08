"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  getSpotGoods,
  updateSpotGoodsPrice,
  updateSpotGoodsStock,
  UpdatedSpotGoodsRefreshError,
  ValidationError,
  type ServiceOptions,
  type SpotGoods,
} from "@sast-shop/api";
import {
  formatPrice,
  MAX_INT32_CENTS,
  parseYuanToCents,
} from "@sast-shop/domain";
import { RiSaveLine } from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";
import { useTransactionAgreement } from "./transaction-agreement-provider";

type PendingUpdate = {
  field: "price" | "stock";
  value: number;
  confirmed: boolean;
  remainingStock?: number;
  priceSaved: boolean;
};

type Verification =
  | { status: "matched" | "mismatched"; goods: SpotGoods }
  | { status: "unavailable" };

class GoodsIdentityError extends Error {
  constructor() {
    super("商品身份已变化，请重新核实后再继续");
  }
}

export function SpotGoodsEditor({
  goods,
  serviceOptions,
  onUpdated,
  onBusyChange,
  onCancel,
}: {
  goods: SpotGoods;
  serviceOptions: ServiceOptions;
  onUpdated: (goods: SpotGoods) => void;
  onBusyChange: (busy: boolean) => void;
  onCancel?: () => void;
}) {
  const { ensureAgreement } = useTransactionAgreement();
  const [latest, setLatest] = useState(goods);
  const [price, setPrice] = useState((goods.salePriceCents / 100).toFixed(2));
  const [stock, setStock] = useState(String(goods.stock));
  const [priceError, setPriceError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [delistOpen, setDelistOpen] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingUpdate | null>(null);
  const mountedRef = useRef(true);
  const priceRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function beginOperation() {
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
  }

  function finishOperation() {
    busyRef.current = false;
    if (!mountedRef.current) return;
    setBusy(false);
    onBusyChange(pendingRef.current !== null);
  }

  function assertIdentity(result: SpotGoods) {
    if (result.id !== goods.id || result.sellerId !== goods.sellerId)
      throw new GoodsIdentityError();
  }

  function applyLatest(result: SpotGoods, previous: SpotGoods) {
    assertIdentity(result);
    setLatest(result);
    setPrice((current) =>
      current === (previous.salePriceCents / 100).toFixed(2)
        ? (result.salePriceCents / 100).toFixed(2)
        : current,
    );
    setStock((current) =>
      current === String(previous.stock) ? String(result.stock) : current,
    );
    onUpdated(result);
  }

  function applySavedField(
    result: SpotGoods,
    previous: SpotGoods,
    update: PendingUpdate,
  ) {
    applyLatest(result, previous);
    if (update.field === "price")
      setPrice((result.salePriceCents / 100).toFixed(2));
    else setStock(String(result.stock));
  }

  function markPending(update: PendingUpdate, message?: string) {
    pendingRef.current = update;
    setPending(update);
    setError(
      message ??
        (update.confirmed
          ? update.field === "price" && update.remainingStock !== undefined
            ? "售价已保存，库存尚未保存，最新商品信息暂不可用，请先刷新核实"
            : "修改已保存，但最新商品信息暂不可用，请先刷新核实"
          : update.priceSaved
            ? "售价已保存，库存保存结果暂时无法确认，请先刷新核实"
            : "暂时无法确认修改结果，请先刷新核实，避免重复保存"),
    );
  }

  async function verify(update: PendingUpdate): Promise<Verification> {
    try {
      const result = await getSpotGoods(goods.id, serviceOptions);
      assertIdentity(result);
      const matches =
        update.field === "price"
          ? result.salePriceCents === update.value
          : result.stock === update.value;
      return {
        status: update.confirmed || matches ? "matched" : "mismatched",
        goods: result,
      };
    } catch {
      return { status: "unavailable" };
    }
  }

  function mismatchMessage(result: SpotGoods, priceSaved: boolean) {
    return (
      (priceSaved ? "售价已保存，库存修改尚未确认，" : "尚未确认修改已保存，") +
      "已读取最新售价 " +
      formatPrice(result.salePriceCents) +
      "、库存 " +
      (result.stock === -1 ? "已下架" : `${result.stock} 件`) +
      "，请核对后重新保存"
    );
  }

  async function save(event?: FormEvent<HTMLFormElement>, delisting = false) {
    event?.preventDefault();
    if (busyRef.current || pendingRef.current || (delistOpen && !delisting))
      return;
    const priceValue = delisting
      ? latest.salePriceCents
      : parseYuanToCents(price.trim());
    const stockValue = delisting
      ? -1
      : /^\d{1,10}$/.test(stock.trim()) ||
          (latest.stock === -1 && stock === "-1")
        ? Number(stock.trim())
        : null;
    const invalidPrice =
      priceValue === null || priceValue <= 0 || priceValue > MAX_INT32_CENTS;
    const invalidStock =
      stockValue === null ||
      stockValue > 999 ||
      (!delisting && latest.stock === -1 && stockValue === 0);
    setPriceError(
      invalidPrice
        ? price.trim()
          ? "请输入大于 0 的金额，最多两位小数"
          : "请输入售价"
        : null,
    );
    setStockError(
      invalidStock
        ? stock.trim()
          ? latest.stock === -1
            ? "重新上架请输入 1 至 999 的整数"
            : "请输入 0 至 999 的整数"
          : "请输入库存"
        : null,
    );
    if (
      invalidPrice ||
      invalidStock ||
      priceValue === null ||
      stockValue === null
    ) {
      if (invalidPrice) priceRef.current?.focus();
      else stockRef.current?.focus();
      return;
    }
    const changePrice = !delisting && priceValue !== latest.salePriceCents;
    const changeStock = stockValue !== latest.stock;
    if (!changePrice && !changeStock) return;
    beginOperation();
    setError(null);
    let current = latest;
    let priceSaved = false;
    try {
      if (!(await ensureAgreement()) || !mountedRef.current) return;
      const changes: Array<{ field: "price" | "stock"; value: number }> = [];
      if (changePrice) changes.push({ field: "price", value: priceValue });
      if (changeStock) changes.push({ field: "stock", value: stockValue });
      for (const change of changes) {
        if (
          change.value ===
          (change.field === "price" ? current.salePriceCents : current.stock)
        )
          continue;
        const update: PendingUpdate = {
          ...change,
          confirmed: false,
          priceSaved,
          remainingStock:
            change.field === "price" && changeStock ? stockValue : undefined,
        };
        let saved: SpotGoods;
        try {
          const input = { spotGoodsId: goods.id, updatedAt: current.updatedAt };
          saved =
            change.field === "price"
              ? await updateSpotGoodsPrice(
                  { ...input, newSalePriceCents: change.value },
                  serviceOptions,
                )
              : await updateSpotGoodsStock(
                  { ...input, newStock: change.value },
                  serviceOptions,
                );
          if (!mountedRef.current) return;
          assertIdentity(saved);
        } catch (caught) {
          if (!mountedRef.current) return;
          if (caught instanceof ValidationError) {
            setError(
              (priceSaved ? "售价已保存，库存保存失败：" : "") + caught.message,
            );
            return;
          }
          if (caught instanceof GoodsIdentityError) {
            markPending(update, caught.message);
            return;
          }
          update.confirmed = caught instanceof UpdatedSpotGoodsRefreshError;
          const verification = await verify(update);
          if (!mountedRef.current) return;
          if (verification.status === "unavailable") {
            markPending(update);
            return;
          }
          if (verification.status === "mismatched") {
            applyLatest(verification.goods, current);
            setError(mismatchMessage(verification.goods, priceSaved));
            return;
          }
          saved = verification.goods;
        }
        applySavedField(saved, current, update);
        current = saved;
        if (change.field === "price") priceSaved = true;
      }
      if (delisting && current.stock !== -1) {
        setError("最新商品仍在上架，请核对库存后重新操作");
        return;
      }
      toast.success(delisting ? "商品已下架" : "修改已保存");
    } finally {
      finishOperation();
    }
  }

  async function refreshPending() {
    const update = pendingRef.current;
    if (busyRef.current || !update) return;
    beginOperation();
    try {
      const verification = await verify(update);
      if (!mountedRef.current) return;
      if (verification.status === "unavailable") {
        markPending(update);
        return;
      }
      pendingRef.current = null;
      setPending(null);
      if (verification.status === "mismatched") {
        applyLatest(verification.goods, latest);
        setError(mismatchMessage(verification.goods, update.priceSaved));
        return;
      }
      applySavedField(verification.goods, latest, update);
      if (
        update.field === "stock" &&
        update.value === -1 &&
        verification.goods.stock !== -1
      ) {
        setError("最新商品仍在上架，请核对库存后重新操作");
        return;
      }
      if (
        update.remainingStock !== undefined &&
        verification.goods.stock !== update.remainingStock
      ) {
        setError("售价已保存，库存修改尚未保存，请核对后保存修改");
      } else {
        setError(null);
        toast.success("修改已保存");
      }
    } finally {
      finishOperation();
    }
  }

  const locked = busy || pending !== null || delistOpen;
  const unchanged =
    parseYuanToCents(price.trim()) === latest.salePriceCents &&
    (/^\d{1,10}$/.test(stock.trim()) ||
      (latest.stock === -1 && stock === "-1")) &&
    Number(stock.trim()) === latest.stock;

  return (
    <>
      <form
        id="spot-goods-edit-form"
        noValidate
        onSubmit={(event) => void save(event)}
        className="app-scrollbar min-h-0 flex-1 overflow-y-auto pb-4"
      >
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(priceError)}>
            <FieldLabel htmlFor="spot-edit-price">现货售价（元）</FieldLabel>
            <Input
              autoFocus
              ref={priceRef}
              id="spot-edit-price"
              inputMode="decimal"
              value={price}
              disabled={locked}
              maxLength={16}
              aria-invalid={Boolean(priceError)}
              aria-describedby={
                priceError ? "spot-edit-price-error" : undefined
              }
              onChange={(event) => {
                setPrice(event.target.value);
                setPriceError(null);
              }}
            />
            <FieldError id="spot-edit-price-error">{priceError}</FieldError>
          </Field>
          <Field data-invalid={Boolean(stockError)}>
            <FieldLabel htmlFor="spot-edit-stock">可售库存（件）</FieldLabel>
            <Input
              ref={stockRef}
              id="spot-edit-stock"
              type="number"
              min={latest.stock === -1 ? 1 : 0}
              max={999}
              step={1}
              inputMode="numeric"
              value={stock === "-1" ? "" : stock}
              disabled={locked}
              maxLength={10}
              aria-invalid={Boolean(stockError)}
              aria-describedby={
                stockError ? "spot-edit-stock-error" : "spot-edit-stock-help"
              }
              onChange={(event) => {
                setStock(event.target.value);
                setStockError(null);
              }}
            />
            <FieldError id="spot-edit-stock-error">{stockError}</FieldError>
            <FieldDescription id="spot-edit-stock-help">
              {latest.stock === -1
                ? "商品已下架，填写 1 至 999 的库存并保存即可重新上架"
                : "填写剩余可售件数，设为 0 后暂停购买"}
            </FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {pending ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void refreshPending()}
            >
              {busy ? <Spinner data-icon="inline-start" /> : null}刷新核实
            </Button>
          ) : null}
        </FieldGroup>
      </form>
      <DialogFooter className="shrink-0 border-t pt-4">
        {latest.stock !== -1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() => setDelistOpen(true)}
          >
            下架商品
          </Button>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={onCancel}
          >
            取消
          </Button>
        ) : null}
        <Button
          type="submit"
          form="spot-goods-edit-form"
          disabled={locked || unchanged}
        >
          {busy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiSaveLine data-icon="inline-start" />
          )}
          {busy ? "正在保存" : "保存修改"}
        </Button>
      </DialogFooter>
      <Dialog
        open={delistOpen}
        onOpenChange={(open) => {
          if (!busyRef.current) setDelistOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>下架商品</DialogTitle>
            <DialogDescription>
              下架后商品将不在商城展示，可在这里重新上架
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelistOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setDelistOpen(false);
                void save(undefined, true);
              }}
            >
              确认下架
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
