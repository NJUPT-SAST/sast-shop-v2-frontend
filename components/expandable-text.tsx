"use client"

import { Button } from "@heroui/react"
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
        <Button
          className="self-start !h-auto !min-h-0 !min-w-0 !p-0 text-[12px] text-shop-primary"
          onPress={() => setExpanded(!expanded)}
          size="sm"
          variant="ghost"
        >
          {expanded ? "收起" : "展开全部"}
        </Button>
      ) : null}
    </div>
  )
}
