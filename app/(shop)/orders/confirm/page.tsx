"use client"

import { AddressCard } from "@/components/address/address-card"
import { AddressPicker } from "@/components/address/address-picker"
import { FormField } from "@/components/forms/form-field"
import { FormProvider, useTypedForm } from "@/components/forms/typed-form"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StickyActionBar } from "@/components/layout/sticky-action-bar"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonDetail } from "@/components/states/skeleton-detail"
import { isApiError } from "@/lib/api/errors"
import { useCreateOrder, useListing } from "@/lib/api/queries"
import type { Listing } from "@/lib/api/types"
import { type CreateOrderFormInput, createOrderSchema } from "@/lib/schemas/order"
import { type Address, formatAddress, useAddressStore } from "@/lib/stores/address-store"
import { formatPrice, sumPrice } from "@/lib/utils/format"
import { notify } from "@/lib/utils/toast"
import { Button, TextArea } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

export default function ConfirmOrderPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmOrderInner />
    </Suspense>
  )
}

function ConfirmOrderInner() {
  const router = useRouter()
  const params = useSearchParams()
  const listingId = params.get("listing_id") || ""
  const { data: listing, isPending, isError, error, refetch } = useListing(listingId)
  const create = useCreateOrder()
  const addresses = useAddressStore((s) => s.addresses)
  const getDefault = useAddressStore((s) => s.getDefault)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<Address | undefined>(undefined)

  // Pick the default address whenever the address list refreshes (zustand store
  // is hydrated asynchronously from localStorage on first render).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `getDefault` is a stable selector
  useEffect(() => {
    if (selectedAddress) return
    const def = getDefault()
    if (def) setSelectedAddress(def)
  }, [addresses.length, selectedAddress])

  const form = useTypedForm(createOrderSchema, {
    defaultValues: {
      listing_id: listingId,
      quantity: 1,
      shipping_address: "",
      remark: "",
    },
  })

  // Keep listing_id in sync with the URL param.
  useEffect(() => {
    if (listingId) form.setValue("listing_id", listingId)
  }, [listingId, form])

  const quantity = form.watch("quantity") ?? 1
  const remark = form.watch("remark") ?? ""

  if (isPending) {
    return (
      <>
        <MobileHeader showBack title="确认下单" />
        <SkeletonDetail />
      </>
    )
  }
  if (isError || !listing) {
    return (
      <>
        <MobileHeader showBack title="确认下单" />
        <div className="mx-auto w-full max-w-3xl px-4 pt-6">
          <ErrorState error={error} onRetry={() => refetch()} title="商品不存在或已下架" />
        </div>
      </>
    )
  }

  const needsAddress = listing.delivery_mode === "express"
  const subtotal = (Number(listing.price) * quantity).toFixed(2)
  const showShippingLine = listing.shipping_mode !== "free"
  const shippingDisplay =
    listing.shipping_mode === "fixed" && listing.shipping_fee
      ? formatPrice(listing.shipping_fee)
      : listing.shipping_mode === "variable"
        ? "运费另议"
        : null
  const total =
    listing.shipping_mode === "fixed" ? sumPrice(subtotal, listing.shipping_fee ?? "0") : subtotal

  async function onSubmit(values: CreateOrderFormInput) {
    if (needsAddress && !selectedAddress) {
      notify({ title: "请选择收货地址", color: "warning" })
      return
    }
    try {
      const order = await create.mutateAsync({
        listing_id: values.listing_id,
        quantity: values.quantity,
        shipping_address:
          needsAddress && selectedAddress ? formatAddress(selectedAddress) : undefined,
        remark: values.remark || undefined,
      })
      router.replace(`/orders/${order.id}`)
    } catch (err) {
      notify({
        title: isApiError(err) ? err.message : "下单失败，请稍后重试",
        color: "danger",
      })
    }
  }

  return (
    <>
      <MobileHeader showBack title="确认下单" />
      <FormProvider {...form}>
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-24 md:gap-4 md:px-8 md:py-8"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <h1 className="hidden text-[24px] font-semibold text-shop-text-primary md:block">
            确认下单
          </h1>

          <ListingSummary
            listing={listing}
            onChange={(n) => form.setValue("quantity", n, { shouldValidate: true })}
            quantity={quantity}
          />

          {needsAddress ? (
            <section className="shop-section">
              <h2 className="shop-section__title">收货信息</h2>
              {selectedAddress ? (
                <AddressCard address={selectedAddress} variant="readonly" />
              ) : (
                <button
                  className="rounded-shop-md border border-dashed border-shop-border-strong bg-shop-bg-tinted px-4 py-3 text-left text-[13px] text-shop-text-secondary transition hover:border-shop-primary hover:text-shop-primary"
                  onClick={() => setPickerOpen(true)}
                  type="button"
                >
                  <Icon
                    className="mr-1 inline size-4 align-text-bottom"
                    icon="material-symbols:add-location-rounded"
                  />
                  选择 / 新建收货地址
                </button>
              )}
              {selectedAddress ? (
                <button
                  className="self-end text-[12px] text-shop-primary transition hover:opacity-80"
                  onClick={() => setPickerOpen(true)}
                  type="button"
                >
                  更换地址
                </button>
              ) : null}
            </section>
          ) : null}

          <section className="shop-section">
            <h2 className="shop-section__title">订单备注</h2>
            <FormField hint="选填，留言给卖家" maxLength={500} name="remark">
              <TextArea
                className="shop-input-group"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  form.setValue("remark", e.target.value)
                }
                placeholder="例如：希望发顺丰、备注盲盒款式…"
                rows={3}
                value={remark}
                variant="secondary"
              />
            </FormField>
          </section>

          <section className="shop-section">
            <h2 className="shop-section__title">支付方式</h2>
            <div className="flex items-center gap-3 rounded-shop-sm bg-shop-bg-tinted px-3 py-2">
              <Icon
                className="size-5 text-shop-primary"
                icon={
                  listing.payment_mode === "qr_code"
                    ? "material-symbols:qr-code-scanner-rounded"
                    : "material-symbols:credit-card-rounded"
                }
              />
              <span className="text-[13px] text-shop-text-secondary">
                {listing.payment_mode === "qr_code"
                  ? "卖家收款码 · 4 位备注码确认"
                  : "微信 / 支付宝 子商户支付"}
              </span>
            </div>
            {listing.shipping_mode === "variable" ? (
              <div className="flex items-start gap-2 rounded-shop-sm bg-shop-warning-soft px-3 py-2 text-[12px] text-shop-warning">
                <Icon className="size-4 shrink-0 mt-0.5" icon="material-symbols:warning-rounded" />
                <span>运费另议 — 卖家会在确认收款后通知你支付运费</span>
              </div>
            ) : null}
          </section>

          <section className="shop-section">
            <h2 className="shop-section__title">费用明细</h2>
            <dl className="flex flex-col gap-1.5 text-[14px]">
              <Row label="商品金额" value={formatPrice(subtotal)} />
              {showShippingLine ? <Row label="运费" value={shippingDisplay ?? "另议"} /> : null}
              <div className="mt-1 flex items-baseline justify-between border-t border-shop-border-light pt-2 text-[15px] font-semibold">
                <dt>{listing.shipping_mode === "fixed" ? "合计" : "应付"}</dt>
                <dd className="text-[20px] tabular-nums text-shop-primary">
                  <span className="text-[14px]">¥</span>
                  {Number(total).toFixed(2)}
                </dd>
              </div>
            </dl>
          </section>

          <StickyActionBar>
            <span className="flex-1 text-[12px] text-shop-text-tertiary">
              合计：
              <span className="ml-1 text-[16px] font-bold tabular-nums text-shop-primary">
                <span className="text-[12px]">¥</span>
                {Number(total).toFixed(2)}
              </span>
            </span>
            <Button isPending={create.isPending} type="submit" variant="primary">
              提交订单
            </Button>
          </StickyActionBar>
        </form>
      </FormProvider>

      <AddressPicker
        onOpenChange={setPickerOpen}
        onPick={(addr) => setSelectedAddress(addr)}
        open={pickerOpen}
        selectedId={selectedAddress?.id}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-shop-text-secondary">{label}</dt>
      <dd className="text-shop-text-primary tabular-nums">{value}</dd>
    </div>
  )
}

function ListingSummary({
  listing,
  quantity,
  onChange,
}: {
  listing: Listing
  quantity: number
  onChange: (n: number) => void
}) {
  const max = Math.max(1, listing.stock)
  return (
    <section className="shop-section flex !flex-row gap-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-shop-sm bg-shop-bg-tinted">
        {listing.image_urls[0] ? (
          <img alt="" className="size-full object-cover" src={listing.image_urls[0]} />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-[14px] font-medium text-shop-text-primary">
          {listing.title}
        </span>
        <span className="text-[18px] font-bold tabular-nums text-shop-primary">
          <span className="text-[12px]">¥</span>
          {Number(listing.price).toFixed(2)}
        </span>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-shop-text-secondary">
          <button
            aria-label="减少"
            className="flex size-8 items-center justify-center rounded-shop-sm border border-shop-border bg-shop-bg-white transition active:scale-95 disabled:opacity-50"
            disabled={quantity <= 1}
            onClick={() => onChange(Math.max(1, quantity - 1))}
            type="button"
          >
            <Icon className="size-4" icon="material-symbols:remove-rounded" />
          </button>
          <span className="min-w-[2ch] text-center text-[14px] tabular-nums text-shop-text-primary">
            {quantity}
          </span>
          <button
            aria-label="增加"
            className="flex size-8 items-center justify-center rounded-shop-sm border border-shop-border bg-shop-bg-white transition active:scale-95 disabled:opacity-50"
            disabled={quantity >= max}
            onClick={() => onChange(Math.min(max, quantity + 1))}
            type="button"
          >
            <Icon className="size-4" icon="material-symbols:add-rounded" />
          </button>
          <span>库存 {listing.stock}</span>
        </div>
      </div>
    </section>
  )
}
