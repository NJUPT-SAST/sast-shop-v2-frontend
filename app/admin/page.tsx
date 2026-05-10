"use client"

import { MobileHeader } from "@/components/layout/mobile-header"
import { CountUp } from "@/components/motion/count-up"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonList } from "@/components/states/skeleton-list"
import { isApiError } from "@/lib/api/errors"
import {
  useAdminListings,
  useAdminOrders,
  useAdminReviews,
  useApproveReview,
} from "@/lib/api/queries"
import { notify } from "@/lib/utils/toast"
import { Button, Skeleton } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"

export default function AdminHomePage() {
  const reviews = useAdminReviews("pending")
  const listings = useAdminListings({ limit: 1 })
  const orders = useAdminOrders({ limit: 1 })
  const approve = useApproveReview()

  async function quickApprove(id: string) {
    try {
      await approve.mutateAsync(id)
      notify({ title: "已通过审核", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "操作失败", color: "danger" })
    }
  }

  return (
    <>
      <MobileHeader title="管理首页" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-8">
        <header className="hidden md:block">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">管理首页</h1>
          <p className="mt-1 text-[14px] text-shop-text-secondary">SAST Shop 平台运营概览</p>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <StatCard
            accent="from-shop-warning to-[#ffbe5e]"
            href="/admin/reviews"
            icon="material-symbols:fact-check-rounded"
            isPending={reviews.isPending}
            title="待审核"
            value={reviews.data?.total}
          />
          <StatCard
            accent="from-shop-primary to-shop-primary-hover"
            href="/admin/listings"
            icon="material-symbols:inventory-2-rounded"
            isPending={listings.isPending}
            title="商品总数"
            value={listings.data?.total}
          />
          <StatCard
            accent="from-shop-secondary to-[#3fc28b]"
            href="/admin/orders"
            icon="material-symbols:assignment-rounded"
            isPending={orders.isPending}
            title="订单总数"
            value={orders.data?.total}
          />
        </div>

        <section className="shop-section">
          <header className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold text-shop-text-primary">最近待审核</h2>
            <Link className="text-[13px] text-shop-primary" href="/admin/reviews">
              查看全部 →
            </Link>
          </header>
          {reviews.isPending ? (
            <SkeletonList count={3} />
          ) : reviews.data?.items.length ? (
            <ul className="flex flex-col gap-2">
              {reviews.data.items.slice(0, 5).map((r) => (
                <li
                  className="flex items-center gap-3 rounded-shop-sm bg-shop-bg-tinted px-3 py-2"
                  key={r.id}
                >
                  <div className="flex size-10 items-center justify-center rounded-shop-sm bg-shop-warning-soft text-shop-warning">
                    <Icon className="size-5" icon="material-symbols:hourglass-bottom-rounded" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="line-clamp-1 text-[14px] font-medium text-shop-text-primary">
                      {r.listing.title}
                    </span>
                    <span className="text-[12px] text-shop-text-tertiary">
                      卖家 {r.seller.name}
                    </span>
                  </div>
                  <Button
                    isPending={approve.isPending}
                    onPress={() => quickApprove(r.id)}
                    size="sm"
                    variant="primary"
                  >
                    通过
                  </Button>
                  <Link
                    className="text-[12px] text-shop-text-secondary transition hover:text-shop-primary"
                    href="/admin/reviews"
                  >
                    详情 →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="所有审核都处理完毕，干得漂亮"
              icon="material-symbols:celebration-rounded"
              title="没有待审核的项目"
            />
          )}
        </section>
      </div>
    </>
  )
}

function StatCard({
  href,
  icon,
  title,
  value,
  isPending,
  accent,
}: {
  href: string
  icon: string
  title: string
  value?: number
  isPending?: boolean
  accent: string
}) {
  return (
    <Link className="shop-card shop-card--interactive flex items-center gap-3 p-4" href={href}>
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-shop-md bg-gradient-to-br ${accent} text-shop-text-on-primary shadow-shop-md`}
      >
        <Icon className="size-6" icon={icon} />
      </div>
      <div className="flex flex-col">
        <span className="text-[12px] text-shop-text-tertiary">{title}</span>
        {isPending ? (
          <Skeleton className="h-7 w-16 rounded" />
        ) : (
          <span className="text-[24px] font-bold tabular-nums text-shop-text-primary">
            <CountUp to={value ?? 0} />
          </span>
        )}
      </div>
    </Link>
  )
}
