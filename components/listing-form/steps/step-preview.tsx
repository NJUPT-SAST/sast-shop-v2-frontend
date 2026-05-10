"use client"

import { Icon } from "@iconify/react"
import { useFormContext } from "react-hook-form"
import { Section } from "../shared"

const DELIVERY_LABELS: Record<string, string> = {
  express: "快递配送",
  pickup: "校内自取",
  none: "无需配送",
}
const SHIPPING_LABELS: Record<string, string> = {
  free: "包邮",
  fixed: "固定运费",
  variable: "运费另议",
}
const PAYMENT_LABELS: Record<string, string> = {
  qr_code: "收款码",
  sub_merchant: "子商户",
}

/** Read-only summary shown as the last step before submit. */
export function StepPreview() {
  const { getValues } = useFormContext()
  const v = getValues() as Record<string, unknown>
  const images = (v.image_urls as string[]) ?? []
  const isVote = v.cf_mode === "vote_first"
  const isPresale = v.cf_mode === "presale"
  const variants =
    (v.variants as Array<{ name: string; designs: Array<{ name: string; image_url: string }> }>) ??
    []

  return (
    <>
      <Section desc="确认无误后点击「提交审核」" title="预览与提交">
        <div className="flex flex-col gap-2">
          <Row label="标题" value={v.title as string} />
          <Row label="描述" value={(v.description as string) || "—"} multiline />
          <Row label="价格" value={`¥ ${v.price ?? "—"}`} />
          {typeof v.stock === "number" ? <Row label="库存" value={String(v.stock)} /> : null}
          {isVote ? (
            <>
              <Row label="目标票数" value={String(v.target_votes ?? "—")} />
              <Row label="公开实时票数" value={v.show_vote_count ? "是" : "否"} />
            </>
          ) : null}
          {isPresale ? <Row label="目标金额" value={`¥ ${v.target_amount ?? "—"}`} /> : null}
          {(isVote || isPresale) && v.deadline ? (
            <Row label="截止时间" value={String(v.deadline)} />
          ) : null}
          <Row label="配送方式" value={DELIVERY_LABELS[v.delivery_mode as string] ?? "—"} />
          <Row label="运费" value={SHIPPING_LABELS[v.shipping_mode as string] ?? "—"} />
          {v.shipping_mode === "fixed" && v.shipping_fee ? (
            <Row label="运费金额" value={`¥ ${v.shipping_fee}`} />
          ) : null}
          <Row label="支付方式" value={PAYMENT_LABELS[v.payment_mode as string] ?? "—"} />
        </div>
      </Section>

      {images.length > 0 ? (
        <Section title={`商品图片 (${images.length})`}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {images.map((url, i) => (
              <div
                className="relative aspect-square overflow-hidden rounded-shop-sm border border-shop-border-light"
                // biome-ignore lint/suspicious/noArrayIndexKey: read-only preview, order locked.
                key={`${url}-${i}`}
              >
                <img alt="" className="size-full object-cover" src={url} />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-shop-primary px-1.5 py-0.5 text-[10px] text-white">
                    封面
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {isVote && variants.length > 0 ? (
        <Section title={`款式与方案 (${variants.length})`}>
          <div className="flex flex-col gap-3">
            {variants.map((variant, vi) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: read-only preview snapshot.
              <div className="rounded-shop-sm border border-shop-border-light p-3" key={vi}>
                <div className="text-[14px] font-medium text-shop-text-primary">
                  {variant.name || `款式 ${vi + 1}`}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {variant.designs?.map((design, di) => (
                    <div
                      className="text-center"
                      // biome-ignore lint/suspicious/noArrayIndexKey: read-only preview snapshot.
                      key={di}
                    >
                      {design.image_url ? (
                        <div className="aspect-square overflow-hidden rounded-shop-sm border border-shop-border-light">
                          <img
                            alt={design.name}
                            className="size-full object-cover"
                            src={design.image_url}
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-square items-center justify-center rounded-shop-sm border border-dashed border-shop-border bg-shop-bg-tinted text-shop-text-tertiary">
                          <Icon className="size-6" icon="material-symbols:image-outline" />
                        </div>
                      )}
                      <div className="mt-1 truncate text-[11px] text-shop-text-secondary">
                        {design.name || `方案 ${di + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  )
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-shop-border-light py-2 last:border-b-0">
      <span className="w-20 shrink-0 text-[12px] text-shop-text-tertiary">{label}</span>
      <span
        className={`flex-1 text-[13px] text-shop-text-primary ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
      >
        {value || "—"}
      </span>
    </div>
  )
}
