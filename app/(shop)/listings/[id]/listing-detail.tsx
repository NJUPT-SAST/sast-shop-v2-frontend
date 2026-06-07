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
import { Alert, Avatar, Button, Chip, ProgressBar } from "@heroui/react"
import { Icon } from "@iconify/react"
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
          <Chip color="success" size="sm" variant="soft">
            <Chip.Label>包邮</Chip.Label>
          </Chip>
        ) : (
          <Chip color="warning" size="sm" variant="soft">
            <Chip.Label>运费另议</Chip.Label>
          </Chip>
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
              // biome-ignore lint/suspicious/noArrayIndexKey: anonymized stack
              <Avatar className="border-2 border-shop-bg-white" color="accent" key={i} size="sm">
                <Avatar.Fallback>
                  <Icon className="size-3.5" icon="material-symbols:person-rounded" />
                </Avatar.Fallback>
              </Avatar>
            ))}
          </div>
          <span className="text-[12px] text-shop-text-tertiary">已有 {supporters} 位同学支持</span>
        </div>
      ) : null}
      <Alert className="mt-1" status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>预售商品采用子商户支付，未达标自动退款。</Alert.Description>
        </Alert.Content>
      </Alert>
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
        <Alert status="default">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              为保证投票公正，本项目实时票数不公开，将在投票结束后揭晓。
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <VotePanel isClosed={isClosed} listing={listing} />
    </section>
  )
}

function SellerCard({ listing }: { listing: Listing }) {
  const router = useRouter()
  return (
    <section className="shop-section flex !flex-row items-center gap-3">
      <Avatar className="size-12 shrink-0" color="accent">
        {listing.seller.avatar_url ? (
          <Avatar.Image alt={listing.seller.name} src={listing.seller.avatar_url} />
        ) : null}
        <Avatar.Fallback>
          <Icon className="size-6" icon="material-symbols:person-rounded" />
        </Avatar.Fallback>
      </Avatar>
      <div className="flex flex-1 flex-col">
        <span className="text-[15px] font-medium text-shop-text-primary">
          {listing.seller.name}
        </span>
        <span className="text-[12px] text-shop-text-tertiary">卖家</span>
      </div>
      <Button
        onPress={() => router.push(`/secondhand?seller_id=${listing.seller.id}`)}
        size="sm"
        variant="outline"
      >
        Ta 的其他商品
      </Button>
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
      <Button
        aria-label="联系卖家（敬请期待）"
        isIconOnly
        onPress={() => notify({ title: "站内消息功能即将上线", color: "default" })}
        variant="ghost"
      >
        <Icon className="size-6" icon="material-symbols:chat-bubble-outline-rounded" />
      </Button>
      <Button className="flex-1" isDisabled={!canBuy} onPress={handleBuy} variant="primary">
        {canBuy ? "立即购买" : "暂不可购买"}
      </Button>
    </StickyActionBar>
  )
}
