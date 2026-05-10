"use client"

import { ExpandableText } from "@/components/expandable-text"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StickyActionBar } from "@/components/layout/sticky-action-bar"
import { MediaGallery } from "@/components/media/media-gallery"
import { CountUp } from "@/components/motion/count-up"
import { ShareButton } from "@/components/share-button"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonDetail } from "@/components/states/skeleton-detail"
import { ListingStatusBadge, ListingTypeBadge } from "@/components/status-badge"
import { VotePanel } from "@/components/vote-panel"
import { useListing } from "@/lib/api/queries"
import type { Listing } from "@/lib/api/types"
import { useCountdown } from "@/lib/hooks/use-countdown"
import { formatDateTime, formatPrice } from "@/lib/utils/format"
import { notify } from "@/lib/utils/toast"
import { Button, ProgressBar } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

function priceDigits(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—"
  const n = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(n)) return "—"
  return n.toFixed(2)
}

export default function ListingDetailView() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: listing, isPending, isError, error, refetch } = useListing(id)

  if (isPending) {
    return (
      <>
        <MobileHeader showBack title="商品详情" />
        <div className="mx-auto w-full max-w-5xl">
          <SkeletonDetail />
        </div>
      </>
    )
  }

  if (isError || !listing) {
    return (
      <>
        <MobileHeader showBack title="商品详情" />
        <div className="mx-auto w-full max-w-5xl px-4 pt-6">
          <ErrorState error={error} onRetry={() => refetch()} title="无法加载商品" />
        </div>
      </>
    )
  }

  return (
    <>
      <MobileHeader
        rightSlot={<ShareButton text={listing.title} title={listing.title} />}
        showBack
        title="商品详情"
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 pb-24 md:gap-6 md:px-8 md:py-8">
        <MediaGallery
          alt={listing.title}
          aspect={listing.type === "crowdfund" ? "wide" : "square"}
          className="rounded-shop-lg overflow-hidden"
          images={listing.image_urls}
          withThumbnails
        />
        <Header listing={listing} />
        {listing.type === "crowdfund" && listing.cf_mode === "vote_first" ? (
          <VoteSection listing={listing} />
        ) : null}
        {listing.type === "crowdfund" && listing.cf_mode === "presale" ? (
          <PresaleProgress listing={listing} />
        ) : null}
        <Description listing={listing} />
        <SellerCard listing={listing} />
      </div>
      <FloatingActionBar listing={listing} />
    </>
  )
}

function Header({ listing }: { listing: Listing }) {
  const countdown = useCountdown(listing.deadline)
  return (
    <header className="flex flex-col gap-3 px-1">
      <div className="flex flex-wrap items-center gap-2">
        <ListingTypeBadge cfMode={listing.cf_mode} type={listing.type} />
        <ListingStatusBadge status={listing.status} />
        {listing.deadline ? (
          <span
            className={`inline-flex items-center gap-1 rounded-shop-pill px-2 py-0.5 text-[12px] tabular-nums ${
              countdown.expired
                ? "bg-shop-bg-tinted text-shop-text-tertiary"
                : "bg-shop-warning-soft text-shop-warning"
            }`}
          >
            <Icon className="size-3.5" icon="material-symbols:schedule-rounded" />
            {countdown.expired
              ? "已截止"
              : countdown.days > 0
                ? `${countdown.days} 天 ${countdown.hours} 时`
                : `${countdown.hours}:${String(countdown.minutes).padStart(2, "0")}:${String(countdown.seconds).padStart(2, "0")}`}
          </span>
        ) : null}
      </div>
      <h1 className="text-[20px] font-semibold leading-tight text-shop-text-primary md:text-[26px]">
        {listing.title}
      </h1>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[28px] font-bold tabular-nums text-shop-primary">
          <span className="text-[16px]">¥</span>
          {priceDigits(listing.price)}
        </span>
        {listing.shipping_mode === "fixed" && listing.shipping_fee ? (
          <span className="text-[13px] text-shop-text-secondary">
            运费 {formatPrice(listing.shipping_fee)}
          </span>
        ) : listing.shipping_mode === "free" ? (
          <span className="rounded-shop-xs bg-shop-success-soft px-1.5 py-0.5 text-[12px] font-medium text-shop-success">
            包邮
          </span>
        ) : (
          <span className="rounded-shop-xs bg-shop-warning-soft px-1.5 py-0.5 text-[12px] font-medium text-shop-warning">
            运费另议
          </span>
        )}
      </div>
    </header>
  )
}

function Description({ listing }: { listing: Listing }) {
  return (
    <section className="shop-section">
      <h2 className="shop-section__title">商品描述</h2>
      {listing.description ? (
        <ExpandableText collapseAfter={200} text={listing.description} />
      ) : (
        <p className="text-[13px] text-shop-text-tertiary">卖家暂未填写描述</p>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-y-2 text-[13px]">
        <dt className="text-shop-text-tertiary">配送</dt>
        <dd className="text-shop-text-primary">
          {listing.delivery_mode === "express"
            ? "快递"
            : listing.delivery_mode === "pickup"
              ? "校内自提"
              : "无需配送"}
        </dd>
        <dt className="text-shop-text-tertiary">库存</dt>
        <dd className="text-shop-text-primary tabular-nums">{listing.stock}</dd>
        <dt className="text-shop-text-tertiary">上架时间</dt>
        <dd className="text-shop-text-primary">{formatDateTime(listing.created_at)}</dd>
      </dl>
    </section>
  )
}

function PresaleProgress({ listing }: { listing: Listing }) {
  const current = Number(listing.current_amount ?? "0")
  const target = Number(listing.target_amount ?? "0")
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const supporters = listing.supporter_count ?? 0
  return (
    <section className="shop-section">
      <h2 className="shop-section__title">众筹进度</h2>
      <ProgressBar aria-label="众筹进度" color="accent" maxValue={100} value={pct} />
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="text-shop-text-secondary">
          <CountUp
            className="font-semibold text-shop-text-primary"
            format={(n) => Math.round(n).toString()}
            to={supporters}
          />
          {" 人支持"}
        </span>
        <span className="font-semibold text-shop-primary">
          <CountUp format={(n) => `${Math.round(n)}%`} to={pct} />
        </span>
      </div>
      <div className="text-[12px] text-shop-text-tertiary tabular-nums">
        已筹 {formatPrice(listing.current_amount)} · 目标 {formatPrice(listing.target_amount)}
      </div>
      {listing.supporter_count && listing.supporter_count > 0 ? (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(5, supporters) }).map((_, i) => (
              <div
                className="size-7 rounded-full border-2 border-shop-bg-white bg-shop-primary-soft text-shop-primary flex items-center justify-center text-[10px] font-semibold"
                // biome-ignore lint/suspicious/noArrayIndexKey: anonymized stack
                key={i}
              >
                <Icon className="size-3.5" icon="material-symbols:person-rounded" />
              </div>
            ))}
          </div>
          <span className="text-[12px] text-shop-text-tertiary">已有 {supporters} 位同学支持</span>
        </div>
      ) : null}
      <p className="mt-1 rounded-shop-sm bg-shop-bg-tinted px-3 py-2 text-[12px] text-shop-text-secondary">
        <Icon
          className="mr-1 inline size-3.5 align-text-bottom text-shop-info"
          icon="material-symbols:info-rounded"
        />
        预售商品采用子商户支付，未达标自动退款。
      </p>
    </section>
  )
}

function VoteSection({ listing }: { listing: Listing }) {
  const isClosed = listing.status !== "voting"
  return (
    <section className="shop-section">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold text-shop-text-primary">为你喜欢的方案投票</h2>
          {listing.show_vote_count ? (
            <span className="text-[13px] text-shop-primary tabular-nums">
              <CountUp format={(n) => Math.round(n).toString()} to={listing.current_votes ?? 0} /> /{" "}
              {listing.target_votes ?? "—"} 票
            </span>
          ) : null}
        </div>
        <p className="text-[12px] text-shop-text-tertiary">
          点击选择方案。每个款式可投 {listing.variants[0]?.max_votes_per_user ?? 1} 票，可随时撤回。
        </p>
      </header>
      {!listing.show_vote_count ? (
        <div className="rounded-shop-sm bg-shop-bg-tinted px-3 py-2 text-[12px] text-shop-text-secondary">
          <Icon
            className="mr-1 inline size-3.5 align-text-bottom text-shop-info"
            icon="material-symbols:visibility-off-rounded"
          />
          为保证投票公正，本项目实时票数不公开，将在投票结束后揭晓。
        </div>
      ) : null}
      <VotePanel isClosed={isClosed} listing={listing} />
    </section>
  )
}

function SellerCard({ listing }: { listing: Listing }) {
  return (
    <section className="shop-section flex !flex-row items-center gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shop-primary-soft text-shop-primary">
        {listing.seller.avatar_url ? (
          <img
            alt={listing.seller.name}
            className="size-full object-cover"
            src={listing.seller.avatar_url}
          />
        ) : (
          <Icon className="size-6" icon="material-symbols:person-rounded" />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-[15px] font-medium text-shop-text-primary">
          {listing.seller.name}
        </span>
        <span className="text-[12px] text-shop-text-tertiary">卖家</span>
      </div>
      <Link
        className="rounded-shop-pill border border-shop-border bg-shop-bg-white px-3 py-1.5 text-[12px] text-shop-text-secondary transition hover:border-shop-primary hover:text-shop-primary"
        href={`/secondhand?seller_id=${listing.seller.id}`}
      >
        Ta 的其他商品
      </Link>
    </section>
  )
}

function FloatingActionBar({ listing }: { listing: Listing }) {
  const router = useRouter()
  const canBuy =
    (listing.type === "secondhand" && listing.status === "active") ||
    (listing.type === "direct_sale" && listing.status === "active") ||
    (listing.cf_mode === "presale" && listing.status === "active")

  function handleBuy() {
    if (!canBuy) {
      notify({ title: "当前商品不可购买", color: "warning" })
      return
    }
    router.push(`/orders/confirm?listing_id=${listing.id}`)
  }

  // For voting crowdfund, the vote panel is the primary CTA — skip the bar.
  if (listing.cf_mode === "vote_first") return null

  return (
    <StickyActionBar>
      <button
        aria-label="联系卖家（敬请期待）"
        className="shop-icon-btn"
        onClick={() => notify({ title: "站内消息功能即将上线", color: "default" })}
        type="button"
      >
        <Icon className="size-6" icon="material-symbols:chat-bubble-outline-rounded" />
      </button>
      <Button className="flex-1" isDisabled={!canBuy} onPress={handleBuy} variant="primary">
        {canBuy ? "立即购买" : "暂不可购买"}
      </Button>
    </StickyActionBar>
  )
}
