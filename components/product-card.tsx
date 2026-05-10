"use client"

import type { Listing } from "@/lib/api/types"
import Link from "next/link"
import { ListingTypeBadge } from "./status-badge"

function priceDigits(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—"
  const n = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(n)) return "—"
  return n.toFixed(2)
}

export function ProductCard({ listing }: { listing: Listing }) {
  const cover = listing.image_urls[0]
  return (
    <Link
      aria-label={listing.title}
      className="shop-card shop-card--interactive group block focus:outline-none"
      href={`/listings/${listing.id}`}
    >
      <div className="shop-card__media shop-card__media--square">
        {cover ? (
          <img alt={listing.title} className="size-full object-cover" loading="lazy" src={cover} />
        ) : (
          <div className="flex size-full items-center justify-center text-shop-text-tertiary">
            暂无图片
          </div>
        )}
        <div className="shop-card__badge-tl">
          <ListingTypeBadge cfMode={listing.cf_mode} type={listing.type} />
        </div>
      </div>
      <div className="shop-card__body">
        <h3 className="shop-card__title">{listing.title}</h3>
        <div className="shop-card__meta">
          <span className="shop-card__price">{priceDigits(listing.price)}</span>
          <span className="shop-card__seller">{listing.seller.name}</span>
        </div>
      </div>
    </Link>
  )
}
