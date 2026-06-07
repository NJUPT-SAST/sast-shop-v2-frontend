"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { CountUp } from "@/components/motion/count-up"
import { PressShell } from "@/components/ui/press-shell"
import { isApiError } from "@/lib/api/errors"
import { useUnvote, useVote } from "@/lib/api/queries"
import type { Listing, ListingVariant, VoteSelection } from "@/lib/api/types"
import { formatPercent } from "@/lib/utils/format"
import { notify } from "@/lib/utils/toast"
import { Button, ProgressBar, ToggleButton } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useState } from "react"

function variantSelectionsCount(selections: VoteSelection[], variantId: string): number {
  return selections.filter((s) => s.variant_id === variantId).length
}

function isDesignSelected(
  selections: VoteSelection[],
  variantId: string,
  designId: string
): boolean {
  return selections.some((s) => s.variant_id === variantId && s.design_id === designId)
}

export function VotePanel({
  listing,
  initialSelections = [],
  isClosed,
}: {
  listing: Listing
  initialSelections?: VoteSelection[]
  isClosed: boolean
}) {
  const [selections, setSelections] = useState<VoteSelection[]>(initialSelections)
  const [confirmClear, setConfirmClear] = useState(false)
  const vote = useVote(listing.id)
  const unvote = useUnvote(listing.id)

  function toggle(variantId: string, designId: string, max: number) {
    setSelections((prev) => {
      const already = isDesignSelected(prev, variantId, designId)
      if (already) {
        return prev.filter((s) => !(s.variant_id === variantId && s.design_id === designId))
      }
      const taken = variantSelectionsCount(prev, variantId)
      if (taken >= max) {
        // Replace the most recent selection of this variant.
        const lastIdx = [...prev].reverse().findIndex((s) => s.variant_id === variantId)
        if (lastIdx >= 0) {
          const idx = prev.length - 1 - lastIdx
          const next = [...prev]
          next.splice(idx, 1)
          next.push({ variant_id: variantId, design_id: designId })
          return next
        }
      }
      return [...prev, { variant_id: variantId, design_id: designId }]
    })
  }

  async function submit() {
    if (selections.length === 0) {
      notify({ title: "请至少为一个款式投票", color: "warning" })
      return
    }
    try {
      await vote.mutateAsync(selections)
      notify({ title: "投票成功", color: "success" })
    } catch (err) {
      const msg = isApiError(err) ? err.message : "投票失败，请稍后重试"
      notify({ title: msg, color: "danger" })
    }
  }

  async function clearVotes() {
    try {
      await unvote.mutateAsync(undefined)
      setSelections([])
      notify({ title: "已撤回投票", color: "default" })
    } catch (err) {
      const msg = isApiError(err) ? err.message : "撤回失败"
      notify({ title: msg, color: "danger" })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {listing.variants.map((variant) => (
        <VariantBlock
          key={variant.id}
          listing={listing}
          onToggle={toggle}
          selections={selections}
          variant={variant}
        />
      ))}
      <div className="flex items-center justify-between gap-3 rounded-shop-md bg-shop-bg-tinted p-3">
        <span className="text-[12px] text-shop-text-secondary">
          {selections.length > 0 ? `已选 ${selections.length} 项` : "选择喜欢的方案投票"}
        </span>
        <div className="flex gap-2">
          {initialSelections.length > 0 ? (
            <Button
              isPending={unvote.isPending}
              onPress={() => setConfirmClear(true)}
              variant="ghost"
            >
              撤回投票
            </Button>
          ) : null}
          <Button
            isDisabled={isClosed || selections.length === 0}
            isPending={vote.isPending}
            onPress={submit}
            variant="primary"
          >
            {isClosed ? "投票已截止" : "确认投票"}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        confirmLabel="确认撤回"
        description="撤回后你之前投出的票数会全部释放，可重新选择。"
        destructive
        loading={unvote.isPending}
        onConfirm={clearVotes}
        onOpenChange={setConfirmClear}
        open={confirmClear}
        title="撤回所有投票？"
      />
    </div>
  )
}

function VariantBlock({
  variant,
  listing,
  selections,
  onToggle,
}: {
  variant: ListingVariant
  listing: Listing
  selections: VoteSelection[]
  onToggle: (variantId: string, designId: string, max: number) => void
}) {
  const variantTotal = variant.designs.reduce((acc, d) => acc + d.current_votes, 0)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-shop-text-primary">{variant.name}</h3>
        <span className="text-xs text-shop-text-secondary">
          每人最多 {variant.max_votes_per_user} 票
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {variant.designs.map((design) => {
          const selected = isDesignSelected(selections, variant.id, design.id)
          const pct =
            listing.show_vote_count && variantTotal > 0
              ? formatPercent(design.current_votes, variantTotal)
              : null
          const pctNum =
            listing.show_vote_count && variantTotal > 0
              ? Math.min(100, (design.current_votes / variantTotal) * 100)
              : 0
          return (
            <PressShell key={design.id}>
              <ToggleButton
                aria-label={design.name}
                className={`!h-auto !min-h-0 !w-full !flex-col !items-stretch !gap-2 overflow-hidden !rounded-shop-md !border !bg-shop-bg-white !p-3 text-left ${
                  selected
                    ? "!border-shop-primary ring-2 ring-shop-primary"
                    : "!border-shop-border-light hover:!border-shop-primary"
                }`}
                isSelected={selected}
                onChange={() => onToggle(variant.id, design.id, variant.max_votes_per_user)}
                variant="ghost"
              >
                <div className="relative aspect-square overflow-hidden rounded-shop-sm bg-shop-bg-tinted">
                  {design.image_url ? (
                    <img
                      alt={design.name}
                      className="size-full object-cover"
                      src={design.image_url}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-shop-text-tertiary">
                      {design.name}
                    </div>
                  )}
                  {selected ? (
                    <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-shop-primary text-shop-text-on-primary shadow-shop-md">
                      <Icon className="size-4" icon="material-symbols:check-rounded" />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-shop-text-primary">
                    {design.name}
                  </span>
                  {pct ? (
                    <CountUp
                      ariaLabel={`${design.name} 占比`}
                      className="text-[12px] font-semibold text-shop-primary"
                      format={(n) => `${Math.round(n)}%`}
                      to={pctNum}
                    />
                  ) : null}
                </div>
                {listing.show_vote_count ? (
                  <ProgressBar
                    aria-label={`${design.name} 票数`}
                    color="accent"
                    maxValue={Math.max(1, variantTotal)}
                    value={design.current_votes}
                  />
                ) : null}
              </ToggleButton>
            </PressShell>
          )
        })}
      </div>
    </section>
  )
}
