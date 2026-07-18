"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiSearchLine,
  RiStore2Line,
} from "@remixicon/react"
import type { ErrandDemandStoreSummary } from "@sast-shop/api"
import {
  formatErrandDisplayCount,
  formatPrice,
} from "@sast-shop/domain"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"

import { parsePositiveInt64RouteId } from "@/lib/route-id"

const updatedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function ErrandDemandHall({
  demands,
  error,
}: {
  demands: ErrandDemandStoreSummary[]
  error: string | null
}) {
  const [keyword, setKeyword] = useState("")
  const filtered = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase("zh-CN")
    return query
      ? demands.filter((demand) =>
          demand.storeName.toLocaleLowerCase("zh-CN").includes(query),
        )
      : demands
  }, [demands, keyword])

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="muted">团长接单</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            跑腿采购大厅
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            按店铺聚合未接单需求，进入详情后勾选完整需求行。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/group">
            <RiArrowLeftLine data-icon="inline-start" />
            返回团购工作台
          </Link>
        </Button>
      </section>

      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <RiSearchLine />
        </InputGroupAddon>
        <InputGroupInput
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索店铺名称"
          aria-label="搜索店铺名称"
        />
      </InputGroup>

      {error ? (
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title="跑腿需求暂不可用"
          description={error}
        />
      ) : filtered.length === 0 ? (
        <Empty
          icon={<RiStore2Line className="size-5" />}
          title={keyword.trim() ? "没有匹配的店铺需求" : "暂无待接单需求"}
          description={
            keyword.trim()
              ? "换个关键词试试。"
              : "新的跑腿需求会显示在这里。"
          }
        />
      ) : (
        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          {filtered.map((demand) => (
            <DemandCard key={demand.storeId} demand={demand} />
          ))}
        </section>
      )}
    </div>
  )
}

function DemandCard({ demand }: { demand: ErrandDemandStoreSummary }) {
  const id = parsePositiveInt64RouteId(demand.storeId)
  const goodsSubtotal = demand.totalOriginUnitPriceCents
  const serviceFee = demand.totalServiceFeeCents
  const total = goodsSubtotal + serviceFee
  const content = (
    <Card className="h-full min-w-0 transition-colors group-hover:border-primary/40">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <RiStore2Line className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {demand.storeName}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatUpdatedAt(demand.updatedAt)}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">预计合计</p>
          <p className="mt-1 text-lg font-semibold text-primary">
            {formatPrice(total)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            商品 {formatPrice(goodsSubtotal)}
          </Badge>
          <Badge variant="muted">
            跑腿费 {formatPrice(serviceFee)}
          </Badge>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-4 border-t pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <ParticipantAvatars avatars={demand.participantAvatars} />
            <span className="truncate text-sm text-muted-foreground">
              {formatErrandDisplayCount(demand.participantAvatars.length)} 人参与
            </span>
          </div>
          {id ? (
            <span className="inline-flex shrink-0 items-center text-sm font-medium text-primary">
              查看并接单
              <RiArrowRightSLine className="size-4" />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">店铺编号异常</span>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (!id) return <div className="opacity-60">{content}</div>

  return (
    <Link
      href={`/group/errand/${id}`}
      prefetch={false}
      className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  )
}

function ParticipantAvatars({ avatars }: { avatars: string[] }) {
  const visibleAvatars = avatars.slice(0, 3)
  return (
    <div className="flex -space-x-2" aria-hidden="true">
      {(visibleAvatars.length > 0 ? visibleAvatars : [""]).map((avatar, index) => (
        <Avatar key={`${avatar}-${index}`} className="size-7 border-2 border-card">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {avatars.length > 0 ? "用" : "无"}
          </AvatarFallback>
        </Avatar>
      ))}
      {avatars.length > 3 ? (
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
          +{avatars.length - 3}
        </span>
      ) : null}
    </div>
  )
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "更新时间未知"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "更新时间未知"
    : `更新于 ${updatedAtFormatter.format(date)}`
}
