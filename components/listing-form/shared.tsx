"use client"

import { FormField } from "@/components/forms/form-field"
import { useFormContext } from "@/components/forms/typed-form"
import { ImageUpload, type ImageUploadVariant } from "@/components/image-upload"
import type { CreateListingInput, DeliveryMode, PaymentMode, ShippingMode } from "@/lib/api/types"
import { Input, NumberField, Radio, RadioGroup, Switch, TextArea } from "@heroui/react"
import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

// Inline radio helper (HeroUI v3 compound parts).
function Opt({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Radio value={value}>
      <Radio.Control>
        <Radio.Indicator />
      </Radio.Control>
      <Radio.Content>{children}</Radio.Content>
    </Radio>
  )
}

// Section wrapper kept as a re-export for legacy / non-RHF callers.
export function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="shop-section">
      <header className="flex flex-col">
        <h2 className="shop-section__title">{title}</h2>
        {desc ? <p className="shop-section__desc">{desc}</p> : null}
      </header>
      {children}
    </section>
  )
}

export type ListingDraft = Pick<
  CreateListingInput,
  | "title"
  | "description"
  | "price"
  | "stock"
  | "image_urls"
  | "shipping_mode"
  | "shipping_fee"
  | "shipping_qr_url"
  | "payment_mode"
  | "qr_code_url"
  | "delivery_mode"
>

const SHIPPING_OPTIONS: Array<{ v: ShippingMode; label: string; desc: string }> = [
  { v: "free", label: "包邮", desc: "卖家承担运费" },
  { v: "fixed", label: "固定运费", desc: "下单时显示固定金额" },
  { v: "variable", label: "运费另议", desc: "卖家发货前确定运费" },
]

const DELIVERY_OPTIONS: Array<{ v: DeliveryMode; label: string }> = [
  { v: "express", label: "快递配送" },
  { v: "pickup", label: "校内自取" },
  { v: "none", label: "无需配送" },
]

const PAYMENT_OPTIONS: Array<{ v: PaymentMode; label: string; desc: string }> = [
  { v: "qr_code", label: "收款码", desc: "上传你的收款二维码" },
  { v: "sub_merchant", label: "子商户", desc: "微信/支付宝官方商户" },
]

/** Standalone media (image upload) section — can be rendered separately and styled with `variant`. */
export function MediaFields({
  variant = "grid",
  title = "商品图片",
  desc = "第一张作为封面，最多 9 张",
}: {
  variant?: ImageUploadVariant
  title?: string
  desc?: string
}) {
  return (
    <Section desc={desc} title={title}>
      <FormField name="image_urls">
        {({ value, onChange }) => (
          <ImageUpload
            max={9}
            onChange={(urls) => onChange(urls)}
            purpose="listing_image"
            value={(value as string[]) ?? []}
            variant={variant}
          />
        )}
      </FormField>
    </Section>
  )
}

/** Just the title / description / price / stock section. */
export function InfoFields({ showStock = true }: { showStock?: boolean }) {
  return (
    <Section title="商品信息">
      <FormField label="商品名称" maxLength={200} name="title" required>
        <Input placeholder="例如：SAST 周边帆布袋" variant="secondary" />
      </FormField>
      <FormField
        hint="详细描述（成色、尺寸、使用情况）"
        label="商品描述"
        maxLength={5000}
        name="description"
      >
        <TextArea placeholder="支持换行，描述越详细越好" rows={4} variant="secondary" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="价格 (元)" name="price" required>
          <Input inputMode="decimal" placeholder="29.90" variant="secondary" />
        </FormField>
        {showStock ? (
          <FormField label="库存" name="stock">
            {({ value, onChange }) => (
              <NumberField
                minValue={1}
                onChange={(n: number) => onChange(n)}
                value={(value as number) ?? 1}
              >
                <Input variant="secondary" />
              </NumberField>
            )}
          </FormField>
        ) : null}
      </div>
    </Section>
  )
}

/** Delivery method + shipping fee + payment method sections combined. */
export function ShippingPaymentFields({
  lockedPaymentMode,
}: {
  lockedPaymentMode?: PaymentMode
}) {
  const ctx = useFormContext()
  const { watch, setValue } = ctx

  const deliveryMode = watch("delivery_mode") as DeliveryMode
  const shippingMode = watch("shipping_mode") as ShippingMode
  const paymentMode = (lockedPaymentMode ?? watch("payment_mode")) as PaymentMode

  return (
    <>
      <Section title="配送方式">
        <RadioGroup
          onChange={(v) => setValue("delivery_mode", v as DeliveryMode, { shouldValidate: true })}
          value={deliveryMode}
        >
          <div className="flex flex-wrap gap-3">
            {DELIVERY_OPTIONS.map((o) => (
              <Opt key={o.v} value={o.v}>
                {o.label}
              </Opt>
            ))}
          </div>
        </RadioGroup>
      </Section>

      {deliveryMode !== "none" ? (
        <Section title="运费">
          <RadioGroup
            onChange={(v) => setValue("shipping_mode", v as ShippingMode, { shouldValidate: true })}
            value={shippingMode}
          >
            <div className="flex flex-col gap-2">
              {SHIPPING_OPTIONS.map((o) => (
                <Opt key={o.v} value={o.v}>
                  <span className="flex flex-col">
                    <span>{o.label}</span>
                    <span className="text-[12px] text-shop-text-tertiary">{o.desc}</span>
                  </span>
                </Opt>
              ))}
            </div>
          </RadioGroup>
          {shippingMode === "fixed" ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="固定运费 (元)" name="shipping_fee">
                <Input inputMode="decimal" placeholder="例如 8.00" variant="secondary" />
              </FormField>
              <div className="col-span-1 sm:col-span-2">
                <FormField
                  hint="可单独支付运费的二维码"
                  label="运费二维码（可选）"
                  name="shipping_qr_url"
                >
                  {({ value, onChange }) => (
                    <ImageUpload
                      max={1}
                      onChange={(urls) => onChange(urls[0] ?? "")}
                      purpose="shipping_qr"
                      value={typeof value === "string" && value ? [value] : []}
                    />
                  )}
                </FormField>
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title="支付方式">
        {lockedPaymentMode ? (
          <div className="flex items-center gap-2 rounded-shop-sm bg-shop-info/10 px-3 py-2 text-[12px] text-shop-info">
            <Icon className="size-4" icon="material-symbols:lock-rounded" />
            <span>预售必须使用「子商户」支付，未达标自动原路退款。</span>
          </div>
        ) : null}
        <RadioGroup
          isDisabled={Boolean(lockedPaymentMode)}
          onChange={(v) => setValue("payment_mode", v as PaymentMode, { shouldValidate: true })}
          value={paymentMode}
        >
          <div className="flex flex-col gap-2">
            {PAYMENT_OPTIONS.map((o) => (
              <Opt key={o.v} value={o.v}>
                <span className="flex flex-col">
                  <span>{o.label}</span>
                  <span className="text-[12px] text-shop-text-tertiary">{o.desc}</span>
                </span>
              </Opt>
            ))}
          </div>
        </RadioGroup>
        {paymentMode === "qr_code" ? (
          <FormField hint="买家扫此码完成支付" label="收款二维码" name="qr_code_url">
            {({ value, onChange }) => (
              <ImageUpload
                max={1}
                onChange={(urls) => onChange(urls[0] ?? "")}
                purpose="qr_code"
                value={typeof value === "string" && value ? [value] : []}
              />
            )}
          </FormField>
        ) : null}
      </Section>
    </>
  )
}

/**
 * Composite: info + media + shipping/payment. Used by the secondhand single-page
 * form (with `omitMedia` so MediaFields can be rendered separately on top).
 * Crowdfund flows compose the smaller building blocks directly.
 */
export function CommonFields({
  showStock = true,
  lockedPaymentMode,
  omitMedia = false,
}: {
  showStock?: boolean
  lockedPaymentMode?: PaymentMode
  omitMedia?: boolean
}) {
  return (
    <>
      <InfoFields showStock={showStock} />
      {omitMedia ? null : <MediaFields />}
      <ShippingPaymentFields lockedPaymentMode={lockedPaymentMode} />
    </>
  )
}

export function defaultDraft(): ListingDraft {
  return {
    title: "",
    description: "",
    price: "",
    stock: 1,
    image_urls: [],
    shipping_mode: "free",
    shipping_fee: undefined,
    shipping_qr_url: undefined,
    payment_mode: "qr_code",
    qr_code_url: undefined,
    delivery_mode: "express",
  }
}

export function VotePublicSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-shop-sm bg-shop-bg-tinted px-3 py-2">
      <div className="flex flex-col">
        <span className="text-[14px] font-medium text-shop-text-primary">公开实时票数</span>
        <span className="text-[12px] text-shop-text-tertiary">
          关闭后买家只能看到自己的选择，开奖前不展示总票数
        </span>
      </div>
      <Switch isSelected={enabled} onChange={onChange} />
    </div>
  )
}
