"use client"

import { CountUp } from "@/components/motion/count-up"
import type { Listing } from "@/lib/api/types"
import { diffCountdown, formatPrice } from "@/lib/utils/format"
import { ProgressBar } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { ListingTypeBadge } from "./status-badge"

export function CrowdfundCard({ listing }: { listing: Listing }) {
  const cover = listing.image_urls[0]
  const isVote = listing.cf_mode === "vote_first"
  const current = isVote ? (listing.current_votes ?? 0) : Number(listing.current_amount ?? "0")
  const target = isVote ? (listing.target_votes ?? 0) : Number(listing.target_amount ?? "0")
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const countdown = diffCountdown(listing.deadline)
  const supporters = isVote ? `${current}/${target} 票` : `${listing.supporter_count ?? 0} 人支持`

  return (
    <Link
      aria-label={listing.title}
      className="shop-card shop-card--interactive group block focus:outline-none"
      href={`/listings/${listing.id}`}
    >
      <div className="shop-card__media shop-card__media--wide">
        {cover ? (
          <img alt={listing.title} className="size-full object-cover" loading="lazy" src={cover} />
        ) : null}
        <div className="shop-card__badge-tl flex gap-1.5">
          <ListingTypeBadge cfMode={listing.cf_mode} type="crowdfund" />
          {isVote ? (
            <span
              className={`inline-flex items-center gap-1 rounded-shop-pill px-2 py-0.5 text-[11px] font-medium ${
                listing.show_vote_count
                  ? "bg-shop-secondary-soft text-shop-secondary"
                  : "bg-shop-bg-tinted text-shop-text-tertiary"
              }`}
            >
              <Icon
                className="size-3"
                icon={
                  listing.show_vote_count
                    ? "material-symbols:visibility-rounded"
                    : "material-symbols:visibility-off-rounded"
                }
              />
              {listing.show_vote_count ? "票数公开" : "票数不公开"}
            </span>
          ) : null}
        </div>
        <div className="shop-card__badge-tr">
          <span className="rounded-shop-pill bg-shop-bg-overlay px-2 py-0.5 text-[11px] font-medium text-shop-text-on-primary backdrop-blur">
            {countdown.text}
          </span>
        </div>
      </div>
      <div className="shop-card__body !gap-2 !p-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-shop-text-primary">
          {listing.title}
        </h3>
        <ProgressBar
          aria-label={`${listing.title} 进度`}
          color="accent"
          maxValue={100}
          value={pct}
        />
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="text-shop-text-secondary">{supporters}</span>
          <span className="font-semibold text-shop-primary">
            <CountUp
              ariaLabel={`完成度 ${Math.round(pct)} 百分比`}
              format={(n) => `${Math.round(n)}%`}
              to={pct}
            />
          </span>
        </div>
        {!isVote ? (
          <div className="text-[12px] text-shop-text-tertiary">
            已筹 {formatPrice(listing.current_amount)} / 目标 {formatPrice(listing.target_amount)}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
