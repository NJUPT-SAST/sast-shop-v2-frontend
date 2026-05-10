"use client"

import { MobileHeader } from "@/components/layout/mobile-header"
import { useDraftStore } from "@/lib/stores/draft-store"
import { Icon } from "@iconify/react"
import Link from "next/link"

const ENTRIES = [
  {
    desc: "把闲置物品转让给同学，发布后立即上线，无需审核",
    eligibility: "所有用户",
    href: "/publish/secondhand",
    icon: "material-symbols:swap-horiz-rounded",
    slot: "secondhand" as const,
    title: "上架二手",
    accent: "from-shop-secondary to-[#3fc28b]",
  },
  {
    desc: "让大家投票决定下一款周边的设计方案",
    eligibility: "需管理员审核",
    href: "/publish/crowdfund-vote",
    icon: "material-symbols:how-to-vote-rounded",
    slot: "vote" as const,
    title: "投票众筹",
    accent: "from-shop-primary to-shop-primary-hover",
  },
  {
    desc: "用预售筹集资金，达成后再开始生产",
    eligibility: "需管理员审核 · 子商户支付",
    href: "/publish/crowdfund-presale",
    icon: "material-symbols:campaign-rounded",
    slot: "presale" as const,
    title: "预售众筹",
    accent: "from-shop-warning to-[#ffbe5e]",
  },
] as const

export default function PublishHubPage() {
  const drafts = useDraftStore((s) => s.drafts)
  return (
    <>
      <MobileHeader title="发布商品" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-8">
        <header className="hidden md:block">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">发布商品</h1>
          <p className="mt-1 text-[14px] text-shop-text-secondary">选择想要发布的类型</p>
        </header>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ENTRIES.map((e) => {
            const draft = drafts[e.slot]
            return (
              <Link
                className="shop-card shop-card--interactive flex flex-col gap-3 p-4"
                href={e.href}
                key={e.href}
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-shop-md bg-gradient-to-br ${e.accent} text-shop-text-on-primary shadow-shop-md`}
                >
                  <Icon className="size-6" icon={e.icon} />
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-shop-text-primary">{e.title}</h2>
                  {draft ? (
                    <span className="rounded-shop-xs bg-shop-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-shop-warning">
                      草稿
                    </span>
                  ) : null}
                </div>
                <p className="text-[13px] text-shop-text-secondary">{e.desc}</p>
                <div className="mt-auto flex items-center gap-1 text-[11px] text-shop-text-tertiary">
                  <Icon className="size-3.5" icon="material-symbols:info-outline-rounded" />
                  {e.eligibility}
                </div>
              </Link>
            )
          })}
        </div>

        {Object.keys(drafts).length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[14px] font-semibold text-shop-text-primary">未保存的草稿</h2>
            <div className="flex flex-col gap-2">
              {(
                Object.entries(drafts) as Array<
                  [
                    "secondhand" | "vote" | "presale",
                    { values: { title?: string }; updatedAt: string },
                  ]
                >
              ).map(([slot, entry]) => {
                const target = ENTRIES.find((e) => e.slot === slot)
                if (!target) return null
                return (
                  <Link className="shop-row" href={target.href} key={slot}>
                    <div className="shop-row__leading">
                      <Icon className="size-5" icon={target.icon} />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <span className="shop-row__title">
                        {entry.values.title || `${target.title} 草稿`}
                      </span>
                      <span className="shop-row__sub">
                        最近编辑 {new Date(entry.updatedAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <Icon
                      className="shop-row__chevron"
                      icon="material-symbols:chevron-right-rounded"
                    />
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
