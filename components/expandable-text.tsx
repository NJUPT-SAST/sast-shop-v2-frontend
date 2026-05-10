"use client"

import { useState } from "react"

type Props = {
  text: string
  /** Approximate character threshold to start collapsed. */
  collapseAfter?: number
  className?: string
}

export function ExpandableText({ text, collapseAfter = 200, className }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > collapseAfter
  const display = expanded || !isLong ? text : `${text.slice(0, collapseAfter)}…`

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <p className="whitespace-pre-wrap text-[14px] leading-[22px] text-shop-text-secondary">
        {display}
      </p>
      {isLong ? (
        <button
          className="self-start text-[12px] text-shop-primary transition active:opacity-70"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? "收起" : "展开全部"}
        </button>
      ) : null}
    </div>
  )
}
