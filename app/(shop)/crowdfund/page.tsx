"use client"

import { CrowdfundCard } from "@/components/crowdfund-card"
import { InfiniteList } from "@/components/infinite-list"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StaggerItem, StaggerList } from "@/components/motion/stagger"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonGrid } from "@/components/states/skeleton-grid"
import { useInfiniteListings } from "@/lib/api/infinite-queries"
import { useListings } from "@/lib/api/queries"
import type { CfMode, ListingStatus } from "@/lib/api/types"
import { diffCountdown } from "@/lib/utils/format"
import { Button, Card } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { useState } from "react"

const MODE_FILTERS: Array<{ key: "all" | CfMode; label: string; icon: string }> = [
  { key: "all", label: "全部", icon: "material-symbols:apps-rounded" },
  { key: "vote_first", label: "投票众筹", icon: "material-symbols:how-to-vote-rounded" },
  { key: "presale", label: "预售众筹", icon: "material-symbols:campaign-rounded" },
]

const STATUS_FILTERS: Array<{ key: "active" | "voting" | "funded" | "closed"; label: string }> = [
  { key: "active", label: "进行中" },
  { key: "voting", label: "投票中" },
  { key: "funded", label: "已达成" },
  { key: "closed", label: "已结束" },
]

export default function CrowdfundPage() {
  const [mode, setMode] = useState<"all" | CfMode>("all")
  const [status, setStatus] = useState<ListingStatus | null>(null)

  const query = useInfiniteListings({
    type: "crowdfund",
    cf_mode: mode === "all" ? undefined : mode,
    status: status ?? undefined,
  })

  // Separate query for the "ending soon" rail (top 6 by deadline asc).
  const ending = useListings({
    type: "crowdfund",
    cf_mode: mode === "all" ? undefined : mode,
    sort: "created_desc",
    limit: 12,
  })
  const endingSoon = (ending.data?.items ?? [])
    .filter((l) => {
      if (!l.deadline) return false
      const ms = new Date(l.deadline).getTime() - Date.now()
      return ms > 0 && ms < 72 * 3600_000
    })
    .slice(0, 6)

  return (
    <>
      <MobileHeader title="众筹专区" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-8">
        <header className="hidden md:flex md:items-baseline md:justify-between">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">众筹专区</h1>
          <p className="text-[13px] text-shop-text-secondary">
            投票决定下一款周边，或参与预售提前抢购
          </p>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {MODE_FILTERS.map((f) => (
            <Button
              className="shrink-0 rounded-shop-pill"
              key={f.key}
              onPress={() => setMode(f.key)}
              size="sm"
              variant={mode === f.key ? "primary" : "outline"}
            >
              <Icon className="size-4" icon={f.icon} />
              {f.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            className="shrink-0 rounded-shop-pill"
            onPress={() => setStatus(null)}
            size="sm"
            variant={status === null ? "primary" : "outline"}
          >
            全部状态
          </Button>
          {STATUS_FILTERS.map((f) => (
            <Button
              className="shrink-0 rounded-shop-pill"
              key={f.key}
              onPress={() => setStatus(f.key)}
              size="sm"
              variant={status === f.key ? "primary" : "outline"}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {endingSoon.length > 0 ? (
          <section className="flex flex-col gap-2">
            <header className="flex items-center gap-2">
              <Icon
                className="size-5 text-shop-warning"
                icon="material-symbols:hourglass-bottom-rounded"
              />
              <h2 className="text-[15px] font-semibold text-shop-text-primary">即将截止</h2>
            </header>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {endingSoon.map((l) => (
                <Link
                  className="block w-60 shrink-0 focus:outline-none"
                  href={`/listings/${l.id}`}
                  key={l.id}
                >
                  <Card className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-shop-lg active:translate-y-0 focus-within:ring-2 focus-within:ring-shop-primary focus-within:ring-offset-2">
                    <div className="aspect-[5/3] overflow-hidden rounded-t-shop-sm bg-shop-bg-tinted">
                      {l.image_urls[0] ? (
                        <img
                          alt={l.title}
                          className="size-full object-cover"
                          loading="lazy"
                          src={l.image_urls[0]}
                        />
                      ) : null}
                    </div>
                    <Card.Content className="flex flex-col gap-1 p-3">
                      <span className="line-clamp-1 text-[13px] font-medium text-shop-text-primary">
                        {l.title}
                      </span>
                      <span className="text-[12px] text-shop-warning tabular-nums">
                        {diffCountdown(l.deadline).text}
                      </span>
                    </Card.Content>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <InfiniteList
          query={query}
          renderEmpty={
            <EmptyState
              description="第一个众筹项目即将上线，敬请期待"
              icon="material-symbols:campaign-rounded"
              title="暂无众筹项目"
            />
          }
          renderItems={(items) => (
            <StaggerList
              className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
              lazy={items.length > 12}
            >
              {items.map((l) => (
                <StaggerItem key={l.id}>
                  <CrowdfundCard listing={l} />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
          renderSkeleton={<SkeletonGrid count={6} variant="crowdfund" />}
        />
      </div>
    </>
  )
}
