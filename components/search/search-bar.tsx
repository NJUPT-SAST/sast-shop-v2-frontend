"use client"

import { useDebouncedSearch } from "@/lib/hooks/use-debounced-search"
import { usePreferenceStore } from "@/lib/stores/preference-store"
import { Icon } from "@iconify/react"
import { AnimatePresence, m } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"

type Props = {
  value?: string
  onChange: (debounced: string) => void
  placeholder?: string
  className?: string
  /** Disable the recent-search popover (e.g. inside admin tables). */
  disableHistory?: boolean
  autoFocus?: boolean
}

export function SearchBar({
  value: controlled,
  onChange,
  placeholder = "搜索商品 / 关键词",
  className,
  disableHistory,
  autoFocus,
}: Props) {
  const inputId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)
  const search = useDebouncedSearch(controlled ?? "", 300)
  const recent = usePreferenceStore((s) => s.recentSearches)
  const pushSearch = usePreferenceStore((s) => s.pushSearch)
  const clearSearches = usePreferenceStore((s) => s.clearSearches)
  const removeSearch = usePreferenceStore((s) => s.removeSearch)

  // Push debounced query upward.
  useEffect(() => {
    onChange(search.debounced)
  }, [search.debounced, onChange])

  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when external `controlled` changes; ignore inner ref churn.
  useEffect(() => {
    if (controlled !== undefined && controlled !== search.raw) {
      search.setRaw(controlled)
    }
  }, [controlled])

  // Click-outside closes the popover.
  useEffect(() => {
    if (!focused) return
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [focused])

  function commit() {
    search.flush()
    if (search.raw.trim()) pushSearch(search.raw.trim())
    setFocused(false)
    inputRef.current?.blur()
  }

  function pickHistory(q: string) {
    search.setRaw(q)
    pushSearch(q)
    onChange(q)
    setFocused(false)
  }

  const showHistory = !disableHistory && focused && recent.length > 0 && search.raw.length === 0

  return (
    <div className={`relative ${className ?? ""}`} ref={containerRef}>
      <div className="flex h-11 items-center gap-2 rounded-shop-pill border border-shop-border-light bg-shop-bg-white pl-4 pr-1.5 shadow-shop-sm focus-within:border-shop-primary focus-within:ring-2 focus-within:ring-shop-primary/20">
        <Icon
          className="size-5 shrink-0 text-shop-text-tertiary"
          icon="material-symbols:search-rounded"
        />
        <input
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-shop-text-primary placeholder:text-shop-text-tertiary focus:outline-none"
          id={inputId}
          onChange={(e) => search.setRaw(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
          }}
          placeholder={placeholder}
          ref={inputRef}
          type="search"
          value={search.raw}
        />
        {search.raw ? (
          <button
            aria-label="清空搜索"
            className="shop-icon-btn !size-8"
            onClick={() => {
              search.clear()
              onChange("")
              inputRef.current?.focus()
            }}
            type="button"
          >
            <Icon className="size-4" icon="material-symbols:close-rounded" />
          </button>
        ) : null}
      </div>
      <AnimatePresence>
        {showHistory ? (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-shop-md border border-shop-border-light bg-shop-bg-white shadow-shop-lg"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between border-b border-shop-border-light px-4 py-2.5 text-[12px] text-shop-text-tertiary">
              <span>最近搜索</span>
              <button
                className="text-shop-text-tertiary transition hover:text-shop-primary"
                onClick={() => clearSearches()}
                type="button"
              >
                清空
              </button>
            </div>
            <ul>
              {recent.map((q) => (
                <li
                  className="flex items-center gap-2 border-b border-shop-border-light/60 px-4 last:border-0"
                  key={q}
                >
                  <button
                    className="flex flex-1 items-center gap-2 py-2.5 text-left text-[14px] text-shop-text-primary"
                    onClick={() => pickHistory(q)}
                    type="button"
                  >
                    <Icon
                      className="size-4 text-shop-text-tertiary"
                      icon="material-symbols:history-rounded"
                    />
                    <span className="truncate">{q}</span>
                  </button>
                  <button
                    aria-label={`移除 ${q}`}
                    className="shop-icon-btn !size-8 shrink-0"
                    onClick={() => removeSearch(q)}
                    type="button"
                  >
                    <Icon className="size-4" icon="material-symbols:close-rounded" />
                  </button>
                </li>
              ))}
            </ul>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
