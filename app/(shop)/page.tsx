"use client"

import { CrowdfundCard } from "@/components/crowdfund-card"
import { MobileHeader } from "@/components/layout/mobile-header"
import { ProductCard } from "@/components/product-card"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonGrid } from "@/components/states/skeleton-grid"
import { OrderStatusBadge } from "@/components/status-badge"
import { useListings, useOrders } from "@/lib/api/queries"
import { useAuthStore } from "@/lib/stores/auth-store"
import { formatPrice } from "@/lib/utils/format"
import { Button, Card } from "@heroui/react"
import { Icon } from "@iconify/react"
import { m } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const HERO_QUICKS = [
  { href: "/secondhand", icon: "material-symbols:storefront-rounded", label: "二手集市" },
  {
    href: "/crowdfund?cf_mode=vote_first",
    icon: "material-symbols:how-to-vote-rounded",
    label: "投票众筹",
  },
  {
    href: "/crowdfund?cf_mode=presale",
    icon: "material-symbols:campaign-rounded",
    label: "预售周边",
  },
]

export default function HomePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const trending = useListings({ type: "crowdfund", sort: "popularity", limit: 6 })
  const fresh = useListings({ type: "secondhand", sort: "created_desc", limit: 8 })
  const myOrders = useOrders({ role: "buyer", limit: 3 })

  const ongoingOrders = (myOrders.data?.items ?? []).filter(
    (o) => o.status !== "completed" && o.status !== "closed" && o.status !== "refunded"
  )

  return (
    <>
      <MobileHeader title="SAST Shop" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 md:gap-8 md:px-8 md:py-8">
        {/* Hero */}
        <m.section
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-shop-xl bg-gradient-to-br from-shop-primary via-shop-primary-hover to-[#06b6d4] p-6 text-shop-text-on-primary shadow-shop-lg md:p-8"
          initial={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-white/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-white/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-1 rounded-shop-pill bg-white/20 px-3 py-1 text-[12px] font-medium backdrop-blur">
              <Icon className="size-3.5" icon="material-symbols:bolt-rounded" />
              南邮 SAST 校园集市
            </span>
            <h1 className="text-[24px] font-bold leading-tight md:text-[32px]">
              {user ? `${user.name.slice(0, 6)}，欢迎回来` : "好物在校园里流转"}
            </h1>
            <p className="max-w-md text-[14px] text-white/90 md:text-[15px]">
              二手交换、众筹周边、官方直售一站式搞定。飞书登录即可开始浏览与下单。
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {HERO_QUICKS.map((q) => (
                <Link
                  className="inline-flex items-center gap-1.5 rounded-shop-pill bg-white/20 px-3 py-2 text-[13px] font-medium backdrop-blur transition active:scale-95 hover:bg-white/30"
                  href={q.href}
                  key={q.href}
                >
                  <Icon className="size-4" icon={q.icon} />
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
        </m.section>

        {/* Ongoing orders (logged-in only) */}
        {user && ongoingOrders.length > 0 ? (
          <section className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-semibold text-shop-text-primary">进行中的订单</h2>
              <Link className="text-[13px] text-shop-primary" href="/orders">
                全部订单 →
              </Link>
            </header>
            <div className="grid gap-2 sm:grid-cols-2">
              {ongoingOrders.slice(0, 2).map((order) => (
                <Link
                  className="block focus:outline-none"
                  href={`/orders/${order.id}`}
                  key={order.id}
                >
                  <Card className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-shop-lg active:translate-y-0 focus-within:ring-2 focus-within:ring-shop-primary focus-within:ring-offset-2">
                    <Card.Content className="flex items-center gap-3 p-3">
                      {order.listing.image_url ? (
                        <img
                          alt=""
                          className="size-12 rounded-shop-sm object-cover"
                          src={order.listing.image_url}
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-shop-sm bg-shop-primary-soft text-shop-primary">
                          <Icon className="size-5" icon="material-symbols:shopping-bag-rounded" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-1 text-[14px] font-medium text-shop-text-primary">
                          {order.listing.title}
                        </span>
                        <span className="text-[12px] text-shop-text-tertiary tabular-nums">
                          {formatPrice(order.amount)}
                        </span>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </Card.Content>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Trending crowdfunds */}
        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold text-shop-text-primary">热门众筹</h2>
            <Link className="text-[13px] text-shop-primary" href="/crowdfund">
              查看全部 →
            </Link>
          </header>
          {trending.isPending ? (
            <SkeletonGrid count={3} variant="crowdfund" />
          ) : trending.isError ? (
            <ErrorState error={trending.error} onRetry={() => trending.refetch()} />
          ) : trending.data?.items.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {trending.data.items.slice(0, 3).map((listing) => (
                <CrowdfundCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState
              description="第一个众筹项目即将上线，敬请期待"
              icon="material-symbols:campaign-rounded"
              title="暂无热门众筹"
            />
          )}
        </section>

        {/* Fresh secondhand */}
        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold text-shop-text-primary">新到二手</h2>
            <Link className="text-[13px] text-shop-primary" href="/secondhand">
              查看全部 →
            </Link>
          </header>
          {fresh.isPending ? (
            <SkeletonGrid count={8} variant="product" />
          ) : fresh.isError ? (
            <ErrorState error={fresh.error} onRetry={() => fresh.refetch()} />
          ) : fresh.data?.items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fresh.data.items.map((listing) => (
                <ProductCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                <Button onPress={() => router.push("/publish/secondhand")} variant="primary">
                  <Icon className="size-4" icon="material-symbols:add-rounded" />
                  发布闲置
                </Button>
              }
              description="发布你不再使用的物品，让校园同学接力使用"
              icon="material-symbols:storefront-rounded"
              title="还没有二手商品"
            />
          )}
        </section>
      </div>
    </>
  )
}
